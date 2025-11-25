import Foundation
import React

@objc(GraphQLUploader)
class GraphQLUploader: NSObject, URLSessionDelegate, URLSessionTaskDelegate, URLSessionDataDelegate {
  // Background URLSession keeps uploads alive on lock/switch/kill
  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.background(withIdentifier: "com.yourapp.graphql.upload")
    config.sessionSendsLaunchEvents = true
    config.isDiscretionary = false
    config.allowsCellularAccess = true
    return URLSession(configuration: config, delegate: self, delegateQueue: nil)
  }()

  private var resolvers: [Int: RCTPromiseResolveBlock] = [:]
  private var rejecters: [Int: RCTPromiseRejectBlock] = [:]
  private var buffers: [Int: Data] = [:]

  @objc(upload:resolver:rejecter:)
  func upload(params: NSDictionary,
              resolver: @escaping RCTPromiseResolveBlock,
              rejecter: @escaping RCTPromiseRejectBlock) {
    guard
      let urlStr = params["url"] as? String,
      let url = URL(string: urlStr),
      let filePath = params["filePath"] as? String
    else {
      rejecter("E_ARGS", "Missing args: url/filePath", nil)
      return
    }

    let token = params["token"] as? String
    let fileURL = URL(fileURLWithPath: filePath)
    let fileName = (params["fileName"] as? String) ?? "image.jpg"
    let mime = (params["mime"] as? String) ?? "image/jpeg"
    let operations = params["operations"] as? [String: Any] ?? [:]
    let map = params["map"] as? [String: [String]] ?? ["0": ["variables.file"]]

    do {
      let mp = Multipart()
      let body = try mp.body(
        operations: operations,
        map: map,
        fileURL: fileURL,
        fileName: fileName,
        mime: mime
      )

      var req = URLRequest(url: url)
      req.httpMethod = "POST"
      mp.headers().forEach { (k, v) in req.setValue(v, forHTTPHeaderField: k) }
      if let token = token {
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      }

      let task = session.uploadTask(with: req, from: body)
      resolvers[task.taskIdentifier] = resolver
      rejecters[task.taskIdentifier] = rejecter
      task.resume()
    } catch {
      rejecter("E_BUILD", "Failed to build multipart body", error)
    }
  }

  // Accumulate response data
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    let id = dataTask.taskIdentifier
    var buf = buffers[id] ?? Data()
    buf.append(data)
    buffers[id] = buf
  }

  // Resolve/reject when finished
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    let id = task.taskIdentifier
    defer {
      resolvers[id] = nil
      rejecters[id] = nil
      buffers[id] = nil
    }

    if let error = error {
      rejecters[id]?("E_UPLOAD", "Upload failed", error)
      return
    }

    let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
    let bodyStr = buffers[id].flatMap { String(data: $0, encoding: .utf8) } ?? ""
    resolvers[id]?([
      "status": status,
      "body": bodyStr
    ])
  }
}

// MARK: - Ordered multipart builder (operations -> map -> "0")
fileprivate struct Multipart {
  let boundary: String = "----graphql\(UUID().uuidString)"

  func headers() -> [String: String] {
    [
      "Content-Type": "multipart/form-data; boundary=\(boundary)",
      "Accept": "application/json"
    ]
  }

  func body(operations: [String: Any],
            map: [String: [String]],
            fileURL: URL,
            fileName: String,
            mime: String) throws -> Data {
    var data = Data()

    func appendField(name: String, value: String) {
      data.append(string: "--\(boundary)\r\n")
      data.append(string: "Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
      data.append(string: "\(value)\r\n")
    }

    // 1) operations
    let opsData = try JSONSerialization.data(withJSONObject: operations, options: [])
    appendField(name: "operations", value: String(data: opsData, encoding: .utf8) ?? "{}")

    // 2) map
    let mapData = try JSONSerialization.data(withJSONObject: map, options: [])
    appendField(name: "map", value: String(data: mapData, encoding: .utf8) ?? "{}")

    // 3) file as "0"
    let fileData = try Data(contentsOf: fileURL)
    data.append(string: "--\(boundary)\r\n")
    data.append(string: "Content-Disposition: form-data; name=\"0\"; filename=\"\(fileName)\"\r\n")
    data.append(string: "Content-Type: \(mime)\r\n\r\n")
    data.append(fileData)
    data.append(string: "\r\n")
    data.append(string: "--\(boundary)--\r\n")
    return data
  }
}

fileprivate extension Data {
  mutating func append(string: String) {
    if let d = string.data(using: .utf8) { append(d) }
  }
}
