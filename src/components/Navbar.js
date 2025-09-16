import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

const Navbar = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);



  // history component routing 
  const onHistoryPress =()=>{
    navigation.navigate("RecentHistory")

  }


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ fontWeight: 'bold' }}>Safety Cam AI</Text>
        </Text>

        <View style={styles.rightButtons}>
          {user && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Image
                source={require('../assets/history-svgrepo-com.png')}
                style={styles.historyImage}
              />
            </TouchableOpacity>
            
          )}

          <TouchableOpacity
            onPress={() => setMenuVisible(!menuVisible)}
            style={styles.menuButton}
          >
            <Text style={styles.menuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal transparent visible={menuVisible} animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.dropdown}>
            {!user ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('AuthLogin');
                  }}
                >
                  <Text style={styles.dropdownItem}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('AuthRegister');
                  }}
                >
                  <Text style={styles.dropdownItem}>Register</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  await logout();
                  setMenuVisible(false);
                  Toast.show({
                    type: 'info',
                    text1: 'Logged out',
                    text2: 'You have been logged out successfully.',
                  });
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }}
              >
                <Text style={styles.dropdownItem}>Logout</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default Navbar;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#007bff',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    color: '#fff',
    fontSize: 18,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    marginRight: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    // borderWidth: 1,
    // borderColor: '#fff',
    // borderRadius: 6,
  },
  historyImage: {
    width: 24,
    height: 24,
    marginRight: 15,
    resizeMode: 'contain',
    tintColor: '#fff', // Optional: makes the image white if it's monochrome PNG
  },
  menuButton: {
    paddingLeft: 4,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
  },
  menuIcon: {
    color: '#fff',
    fontSize: 22,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 60 : 60,
    paddingRight: 16,
    backgroundColor: '#00000055',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
    minWidth: 140,
    elevation: 5,
  },
  dropdownItem: {
    paddingVertical: 8,
    fontSize: 16,
    color: '#000',
  },
});

// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   Modal,
//   Platform,
//   StatusBar,
//   SafeAreaView,
// } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import { useAuth } from '../context/AuthContext';
// import Toast from 'react-native-toast-message';

// const Navbar = () => {
//   const navigation = useNavigation();
//   const { user, logout } = useAuth();
//   const [menuVisible, setMenuVisible] = useState(false);

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <View style={styles.header}>
//         <Text style={styles.logo}>
//           <Text style={{ fontWeight: 'bold' }}>Safety Cam AI</Text>
//         </Text>

//         <TouchableOpacity
//           onPress={() => setMenuVisible(!menuVisible)}
//           style={styles.menuButton}
//         >
//           <Text style={styles.menuIcon}>⋯</Text>
//         </TouchableOpacity>
//       </View>

//       <Modal transparent visible={menuVisible} animationType="fade">
//         <TouchableOpacity
//           style={styles.overlay}
//           onPress={() => setMenuVisible(false)}
//         >
//           <View style={styles.dropdown}>
//             {!user ? (
//               <>
//                 <TouchableOpacity
//                   onPress={() => {
//                     setMenuVisible(false);
//                     navigation.navigate('AuthLogin');

//                   }}
//                 >
//                   <Text style={styles.dropdownItem}>Login</Text>
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   onPress={() => {
//                     setMenuVisible(false);
//                     navigation.navigate('AuthRegister');
//                   }}
//                 >
//                   <Text style={styles.dropdownItem}>Register</Text>
//                 </TouchableOpacity>
//               </>
//             ) : (
//               <TouchableOpacity
//                 onPress={async () => {
//                   await logout();
//                   setMenuVisible(false);
//                   Toast.show({
//                     type: 'info',
//                     text1: 'Logged out',
//                     text2: 'You have been logged out successfully.',
//                   });
//                   navigation.reset({
//                     index: 0,
//                     routes: [{ name: 'Home' }],
//                   });
//                 }}
//               >
//                 <Text style={styles.dropdownItem}>Logout</Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         </TouchableOpacity>
//       </Modal>
//     </SafeAreaView>
//   );
// };

// export default Navbar;

// const styles = StyleSheet.create({
//   safeArea: {
//     backgroundColor: '#007bff',
//     // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
//   },
//   header: {
//     height: 60,
//     paddingHorizontal: 16,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   logo: {
//     color: '#fff',
//     fontSize: 18,
//   },
//   menuButton: {
//     paddingLeft: 4,
//     paddingRight: 4,
//     borderWidth: 1,
//     borderColor: '#fff',
//     borderRadius: 6,
//   },

//   menuIcon: {
//     color: '#fff',
//     fontSize: 22,
//   },
//   overlay: {
//     flex: 1,
//     justifyContent: 'flex-start',
//     alignItems: 'flex-end',
//     paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 60 : 60,
//     paddingRight: 16,
//     backgroundColor: '#00000055',
//   },
//   dropdown: {
//     backgroundColor: '#fff',
//     borderRadius: 6,
//     padding: 10,
//     minWidth: 140,
//     elevation: 5,
//   },
//   dropdownItem: {
//     paddingVertical: 8,
//     fontSize: 16,
//     color: '#000',
//   },
// });
