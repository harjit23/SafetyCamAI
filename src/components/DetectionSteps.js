import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  ScrollView,
  Easing,
} from "react-native";

const steps = [
  "Subscription Initialization",
  "Validating Api Key..",
  "Loading Criminal database..",
  "Detecting Face..",
  "Detection Completed."
];

const DetectionSteps = ({ image, currentStatus }) => {
  const [completedSteps, setCompletedSteps] = useState([]);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const scanAnim = useRef(new Animated.Value(0)).current;

  // Start scanner animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Start spinner
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Mark steps completed
  useEffect(() => {
    if (!currentStatus) {
      setCompletedSteps([]);
      return;
    }

    const idx = steps.findIndex(
      (s) => s.toLowerCase() === currentStatus.toLowerCase()
    );

    if (idx === -1) return;

    setCompletedSteps(steps.slice(0, idx));
  }, [currentStatus]);

  const imageUri =
    typeof image === "string" ? image : image?.uri;

  const validImage =
    imageUri && typeof imageUri === "string" && imageUri.trim().length > 0;

  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criminal Image</Text>

      <View style={styles.imageWrapper}>
        {validImage ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: "#999" }}>No Image</Text>
          </View>
        )}

        <Animated.View
          style={[
            styles.scannerLine,
            { transform: [{ translateY: scanTranslate }] },
          ]}
        />
      </View>

      {/* <Text style={styles.changeText}>Click here to change image</Text> */}

      <ScrollView style={styles.stepList}>
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step);
          const isActive =
            !isCompleted &&
            steps.findIndex((s) => s === step) === completedSteps.length;

          return (
            <View key={idx} style={styles.stepItem}>
              <View style={styles.iconWrapper}>
                {isCompleted ? (
                  <View style={styles.completedCircle}>
                    <Text style={styles.tick}>✓</Text>
                  </View>
                ) : isActive ? (
                  <Animated.View
                    style={[
                      styles.spinnerCircle,
                      { transform: [{ rotate: spin }] },
                    ]}
                  >
                    <View style={styles.spinnerHalf} />
                  </Animated.View>
                ) : (
                  <View style={styles.inactiveCircle} />
                )}
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default DetectionSteps;

const circleSize = 24;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    alignItems: "center",
    marginHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007bff",
    marginBottom: 10,
  },
  imageWrapper: {
    width: 160,
    height: 160,
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ddd",
    borderRadius: 8,
  },
  scannerLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(0,255,0,0.6)",
  },
  changeText: {
    fontSize: 12,
    color: "#555",
    marginVertical: 10,
  },
  stepList: {
    width: "100%",
    marginTop: 10,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  iconWrapper: {
    width: circleSize,
    height: circleSize,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  completedCircle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    backgroundColor: "green",
    justifyContent: "center",
    alignItems: "center",
  },
  tick: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  spinnerCircle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    borderWidth: 2,
    borderColor: "transparent",
    borderTopColor: "green",
  },
  spinnerHalf: {
    width: 0,
    height: 0,
  },
  inactiveCircle: {
    width: circleSize,
    height: circleSize,
    borderRadius: circleSize / 2,
    backgroundColor: "#ccc",
  },
  stepText: {
    fontSize: 14,
    color: "#333",
  },
});





// import  { useEffect, useState } from 'react';
// import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

// const DetectionSteps = ({ image, status }) => {
//   const [allMessages, setAllMessages] = useState([]);

//   useEffect(() => {
//     if (status) {
//       setAllMessages(prev => {
//         if (!prev.includes(status)) {
//           console.log('New step added:', status);
//           return [...prev, status];
//         }
//         return prev;
//       });
//     }
//   }, [status]);
  
//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Criminal Image</Text>

//       <TouchableOpacity onPress={() => console.log(' Image clicked')}>
//         <Image
//           source={{ uri: image?.uri }}
//           style={styles.image}
//         />
//         <Text style={styles.changeText}>Click here to change image</Text>
//       </TouchableOpacity>

//       <ScrollView style={styles.stepList}>
//         {allMessages.map((step, index) => (
//           <View key={index} style={styles.stepItem}>
//             <View style={[styles.bullet, index === allMessages.length - 1 ? styles.active : styles.inactive]} />
//             <Text style={styles.stepText}>{step}</Text>
//           </View>
//         ))}
//       </ScrollView>

//       <View style={styles.verifiedBadge}>
//         <Image
//           source={require('../assets/verified.png')}
//           style={styles.verifiedIcon}
//         />
//         <Text style={styles.verifiedText}>Verified</Text>
//       </View>
//     </View>
//   );
// };

// export default DetectionSteps;

// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: '#fff',
//     borderRadius: 16,
//     padding: 20,
//     marginTop: 40,
//     alignItems: 'center',
//     marginHorizontal: 10,
//     flex: 1,
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#007bff',
//     marginBottom: 10,
//   },
//   image: {
//     width: 160,
//     height: 160,
//     resizeMode: 'cover',
//     borderRadius: 8,
//     marginBottom: 4,
//   },
//   changeText: {
//     fontSize: 12,
//     color: '#555',
//     marginBottom: 20,
//   },
//   stepList: {
//     width: '100%',
//     marginTop: 10,
//   },
//   stepItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginVertical: 6,
//   },
//   bullet: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     marginRight: 10,
//   },
//   active: {
//     backgroundColor: 'green',
//   },
//   inactive: {
//     backgroundColor: '#ccc',
//   },
//   stepText: {
//     fontSize: 14,
//     color: '#333',
//     flexShrink: 1,
//   },
//   verifiedBadge: {
//     position: 'absolute',
//     bottom: -40,
//     right: 20,
//     alignItems: 'center',
//   },
//   verifiedIcon: {
//     width: 30,
//     height: 30,
//     marginBottom: 2,
//   },
//   verifiedText: {
//     fontSize: 12,
//     color: '#007bff',
//   },
// });




