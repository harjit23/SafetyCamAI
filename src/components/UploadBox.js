import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  PermissionsAndroid, Platform, Alert
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

const requestCameraPerms = async () => {
  if (Platform.OS !== 'android') return true;

  const wants = [PermissionsAndroid.PERMISSIONS.CAMERA];

  if (Platform.Version >= 33) {
    // Android 13+
    wants.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
  } else {
    wants.push(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
  }

  const result = await PermissionsAndroid.requestMultiple(wants);
  return Object.values(result).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
};

const UploadBox = ({ onUpload }) => {
  const [selectedImage, setSelectedImage] = useState(null);

  const toPickedAsset = img => ({
    uri: img.path?.startsWith('file://') ? img.path : `file://${img.path}`,
    fileName: img.filename || 'photo.jpg',
    type: img.mime || 'image/jpeg',
    width: img.width,
    height: img.height,
    size: img.size,
  });

  const handleOpenCamera = async () => {
    const ok = await requestCameraPerms();
    if (!ok) {
      Alert.alert('Permission needed', 'Please allow camera/photos access to take a picture.');
      return;
    }

    try {
      const img = await ImagePicker.openCamera({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 0.9,
      });
      const picked = toPickedAsset(img);
      setSelectedImage(picked);
      onUpload?.(picked);
    } catch (e) {
      // User cancelled or error
      console.log('openCamera error:', e?.message || e);
    }
  };

  const handleSelectImage = async () => {
    try {
      const img = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 0.9,
      });
      const picked = toPickedAsset(img);
      setSelectedImage(picked);
      onUpload?.(picked);
    } catch (e) {
      console.log('openPicker error:', e?.message || e);
    }
  };

  return (
    <View style={styles.uploadBox}>
      <Text style={styles.uploadTitle}>Upload Criminal Image</Text>

      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>Note: Upload a Clear Photo</Text>
                <Text style={styles.notee}>For best results, please upload a photo of the person's face : 
                </Text>
               
        <Text style={styles.noteBullet}>{'\u2022'}  From the neck up only</Text>
        <Text style={styles.noteBullet}>{'\u2022'}  Facing forward with good lighting</Text>
        <Text style={styles.noteBullet}>{'\u2022'}  No sunglasses, hats, or masks</Text>
        <Text style={styles.notee2}>The clearer the face, the higher your chances of getting an accurate match.
                </Text>
      </View>
      

      <Text style={styles.label}>Choose File :</Text>

      <TouchableOpacity style={styles.uploadButton} onPress={handleSelectImage}>
        <Image source={require('../assets/Upload-Icon.png')} style={styles.uploadIcon} />
        <Text style={styles.uploadButtonText}>Upload File</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.uploadButton, { marginTop: 10 }]} onPress={handleOpenCamera}>
        <Image source={require('../assets/photo-camera.png')} style={styles.uploadIcon} />
        <Text style={styles.uploadButtonText}>Open Camera</Text>
      </TouchableOpacity>

      {selectedImage && (
        <Image source={{ uri: selectedImage.uri }} style={{ width: 160, height: 160, marginTop: 12, borderRadius: 12 }} />
      )}
    </View>
  );
};

export default UploadBox;

const styles = StyleSheet.create({
  uploadBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 5,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066e6',
    marginBottom: 16,
  },
  noteBox: {
    width: '100%',
    backgroundColor: '#eef5ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteTitle: { fontWeight: '600', color: '#1E40AF', marginBottom: 6 ,fontSize: 16 },
  noteBullet: { color: '#1E40AF', fontWeight: '600'},
  notee2:  { color: '#1B4DDA' , marginTop:5 },
    notee:  { color: '#1B4DDA' , marginBottom:5 },

  label: {
    fontSize: 14,
    color: '#44546f',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#44546f',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    justifyContent: 'center',
  },
  uploadIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginRight: 10,
  },
  uploadButtonText: { fontSize: 16, color: '#44546f' },

  previewWrap: { marginTop: 16, alignItems: 'center' },
  preview: { width: 160, height: 160, borderRadius: 12 },
  recropText: { marginTop: 6, color: '#1a73e8', fontWeight: '600' },
});


// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   Image,
// } from 'react-native';
// import { launchImageLibrary } from 'react-native-image-picker';

// const UploadBox = ({ onUpload }) => {
//   const [selectedImage, setSelectedImage] = useState(null);

//   const handleSelectImage = async () => {
//     console.log(' Upload button clicked');
//     const result = await launchImageLibrary({ mediaType: 'photo' });
//     if (!result.assets?.length) return;

//     const picked = result.assets[0];
//     setSelectedImage(picked);
//     onUpload(picked); 
//   };

//   return (           
//     <View style={styles.uploadBox}>
//       <Text style={styles.uploadTitle}>Upload Criminal Image</Text>
//       <Text style={styles.label}>Choose File :</Text>

//       <TouchableOpacity style={styles.uploadButton} onPress={handleSelectImage}>
//         <Image
//           source={require('../assets/Upload-Icon.png')} 
//           style={styles.uploadIcon}
//         />
//         <Text style={styles.uploadButtonText}>Upload File</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// export default UploadBox;

// const styles = StyleSheet.create({
//   uploadBox: {
//     backgroundColor: '#fff',
//     borderRadius: 20,
//     padding: 30,
//     width: '100%',
//     alignItems: 'center',
//     elevation: 5,
    
//   },
//   uploadTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     color: '#0066e6',
//     marginBottom: 16,
//   },
//   label: {
//     fontSize: 14,
//     color: '#44546f',
//     alignSelf: 'flex-start',
//     marginBottom: 12,
//   },
//   uploadButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderColor: '#44546f',
//     borderWidth: 1,
//     borderRadius: 8,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     width: '100%',
//     justifyContent: 'center',
//     marginTop: 10,
//   },
//   uploadIcon: {
//     width: 22,
//     height: 22,
//     resizeMode: 'contain',
//     marginRight: 10,
//     color: '#44546f'
//   },
//   uploadButtonText: {
//     fontSize: 16,
//     color: '#44546f',
//   },
// });
