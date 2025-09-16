import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

const UploadBox = ({ onUpload }) => {
  const [selectedImage, setSelectedImage] = useState(null);

  const handleSelectImage = async () => {
    console.log(' Upload button clicked');
    const result = await launchImageLibrary({ mediaType: 'photo' });
    if (!result.assets?.length) return;

    const picked = result.assets[0];
    setSelectedImage(picked);
    onUpload(picked); 
  };

  return (           
    <View style={styles.uploadBox}>
      <Text style={styles.uploadTitle}>Upload Criminal Image</Text>
      <Text style={styles.label}>Choose File :</Text>

      <TouchableOpacity style={styles.uploadButton} onPress={handleSelectImage}>
        <Image
          source={require('../assets/Upload-Icon.png')} // use PNG not SVG
          style={styles.uploadIcon}
        />
        <Text style={styles.uploadButtonText}>Upload File</Text>
      </TouchableOpacity>
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
  label: {
    fontSize: 14,
    color: '#44546f',
    alignSelf: 'flex-start',
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
    marginTop: 10,
  },
  uploadIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginRight: 10,
    color: '#44546f'
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#44546f',
  },
});


// import React from 'react';
// import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// const UploadBox = ({ onSelect }) => (
//   <View style={styles.center}>
//     <Text style={styles.title}>Upload Criminal Image</Text>
//     <TouchableOpacity style={styles.box} onPress={onSelect}>
//       <Text style={styles.uploadText}>📤 Tap to select image</Text>
//     </TouchableOpacity>
//   </View>
// );

// export default UploadBox;

// const styles = StyleSheet.create({
//   center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
//   title: { fontSize: 20, marginBottom: 20, fontWeight: '600' },
//   box: {
//     padding: 20,
//     borderWidth: 1,
//     borderRadius: 10,
//     borderColor: '#007bff',
//     backgroundColor: '#fff',
//   },
//   uploadText: { fontSize: 16, color: '#007bff' },
// });
