import React from "react";
import { View, Modal, Image, TouchableOpacity, StyleSheet } from "react-native";

const QRModal = ({ qr, onClose }) => {
  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Image source={{ uri: qr }} style={styles.qrImage} />
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            {/* <Image source={require("../assets/close.png")} style={{ width: 20, height: 20 }} /> */}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default QRModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center" },
  modal: { backgroundColor: "#fff", padding: 20, borderRadius: 10 },
  qrImage: { width: 200, height: 200 },
  closeButton: { position: "absolute", top: 10, right: 10 },
});
