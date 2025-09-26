import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PAGE_SIZE = 2;

const isNoResultItem = (it) => {
  const n = (it?.name || '').toLowerCase();
  return (
    !it ||
    (!it.url && !it.imageUrl && it.confidence === 0) ||
    n.includes('no face detected') ||
    n.includes('no result')
  );
};

const MatchList = ({ image, results = [], onSelectImage }) => {
  const [page, setPage] = useState(1);
  const navigation = useNavigation();

  // detect "no results"
  const noResults =
    !results.length || results.every((r) => isNoResultItem(r));

  const totalPages = Math.ceil(results.length / PAGE_SIZE) || 1;
  const paginatedData = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1); // reset page whenever new results arrive
  }, [results]);

  useEffect(() => {
    console.log('[MATCHLIST RESULTS]', JSON.stringify(results, null, 2));
  }, [results]);

  return (
    <ScrollView contentContainerStyle={styles.wrapper}>
      {/* Uploaded Image */}
      <View style={styles.leftBox}>
        <Text style={styles.sectionTitle}>Criminal Image</Text>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.criminalImage} />
        ) : (
          <View style={[styles.criminalImage, styles.placeholderBox]}>
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
      </View>

      {/* Results */}
      <View style={styles.container}>
        <Text style={styles.title}>Top Matches Found</Text>

        {noResults ? (
          <View style={styles.emptyCard}>
            <Image source={require('../assets/No-docs.png')} /> 
            {/* <View style={styles.emptyIcon} /> */}
            <Text style={styles.emptyTitle}>No Result Found</Text>
            <Text style={styles.emptyDesc}>
              We couldn’t detect a face or find a match. Try a clearer,
              front-facing photo with one face.
            </Text>
          </View>
        ) : (
          <>
            {paginatedData.map((item, index) => {
              const hasImage = !!item.imageUrl;
              const hasUrl = !!item.url;
              return (
                <View key={index} style={styles.card}>
                  {hasImage ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, styles.placeholderBox]}>
                      <Text style={styles.placeholderText}>No img</Text>
                    </View>
                  )}

                  <View style={styles.info}>
                    <Text style={styles.label}>Name:</Text>
                    <Text style={styles.value}>{item.name || 'Unknown'}</Text>

                    <Text style={styles.label}>Accuracy:</Text>
                    <Text style={styles.value}>
                      {typeof item.confidence === 'number'
                        ? `${(item.confidence * 100).toFixed(1)}%`
                        : '—'}
                    </Text>

                    <TouchableOpacity
                      style={[styles.button, !hasUrl && styles.buttonDisabled]}
                      disabled={!hasUrl}
                      onPress={() =>
                        hasUrl &&
                        navigation.navigate('MugshotWebView', { url: item.url })
                      }
                    >
                      <Text style={styles.buttonText}>
                        {hasUrl ? 'More →' : 'No Link'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <TouchableOpacity key={n} onPress={() => setPage(n)}>
                    <Text
                      style={[styles.pageNumber, page === n && styles.activePage]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default MatchList;

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'column', alignItems: 'center', padding: 16 },
  leftBox: {
    backgroundColor: '#fff', padding: 16, borderRadius: 20,
    width: '70%', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20, fontWeight: 'bold', color: '#007bff',
    marginBottom: 10, textAlign: 'center',
  },
  criminalImage: { width: 120, height: 120, borderRadius: 12, marginVertical: 10 },
  placeholderBox: {
    backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center',
  },
  placeholderText: { color: '#667', fontSize: 12 },

  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, margin: 16, width: '100%' },
  title: { fontSize: 20, fontWeight: '700', color: '#007bff', textAlign: 'center', marginBottom: 20 },

  emptyCard: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 24, borderRadius: 12, backgroundColor: '#f8f9ff',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: '#e6edff', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a73e8', marginBottom: 4 },
  emptyDesc: { textAlign: 'center', color: '#555', paddingHorizontal: 16 },

  card: {
    flexDirection: 'row', backgroundColor: '#f8f9ff',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  image: { width: 70, height: 70, borderRadius: 8 },
  info: { marginLeft: 12, flex: 1 },
  label: { fontWeight: '600', fontSize: 14, color: '#333' },
  value: { fontSize: 14, marginBottom: 4, color: '#555' },
  button: {
    marginTop: 8, backgroundColor: '#007bff', paddingVertical: 6,
    paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start',
  },
  buttonDisabled: { backgroundColor: '#a8c5ff' },
  buttonText: { color: '#fff', fontWeight: '500' },

  pagination: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  pageNumber: { marginHorizontal: 6, fontSize: 16, color: '#007bff' },
  activePage: { backgroundColor: '#007bff', color: '#fff', paddingHorizontal: 8, borderRadius: 6 },
});




// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Image,
//   TouchableOpacity,
//   ScrollView,
// } from 'react-native';
// import { useNavigation } from '@react-navigation/native';

// const PAGE_SIZE = 2;

// const MatchList = ({ image, results, onSelectImage }) => {
//   const [page, setPage] = useState(1);
//   const navigation = useNavigation();

//   const totalPages = Math.ceil(results.length / PAGE_SIZE);
//   const paginatedData = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

//  React.useEffect(() => {
//     console.log('[MATCHLIST RESULTS]', JSON.stringify(results, null, 2));
//   }, [results]);

//   return (
//     <ScrollView contentContainerStyle={styles.wrapper}>
//       {/* Top: Uploaded Image Display */}
//       <TouchableOpacity style={styles.leftBox}>
//         <Text style={styles.sectionTitle}>Criminal Image</Text>
//         {image && <Image source={{ uri: image.uri }} style={styles.criminalImage} />}
//       </TouchableOpacity>

//       {/* Bottom: Results List */}
//       <View style={styles.container}>
//         <Text style={styles.title}>Top Matches Found</Text>

//         {paginatedData.map((item, index) => (
//           <View key={index} style={styles.card}>
//             <Image source={{ uri: item.imageUrl }} style={styles.image} />
//             <View style={styles.info}>
//               <Text style={styles.label}>Name:</Text>
//               <Text style={styles.value}>{item.name}</Text>

//               <Text style={styles.label}>Accuracy:</Text>
//               <Text style={styles.value}>{(item.confidence * 100).toFixed(1)}%</Text>

//               <TouchableOpacity
//                 style={styles.button}
//                 onPress={() => navigation.navigate('MugshotWebView', { url: item.url })}
//               >
//                 <Text style={styles.buttonText}>More →</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         ))}

//         {/* Pagination */}
//         <View style={styles.pagination}>
//           {[...Array(totalPages)].map((_, i) => (
//             <TouchableOpacity key={i} onPress={() => setPage(i + 1)}>
//               <Text
//                 style={[
//                   styles.pageNumber,
//                   page === i + 1 && styles.activePage,
//                 ]}
//               >
//                 {i + 1}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </View>
//     </ScrollView>
//   );
// };

// export default MatchList;

// const styles = StyleSheet.create({
//   wrapper: {
//     flexDirection: 'column',
//     alignItems: 'center',
//     padding: 16,
//   },
//   leftBox: {
//     backgroundColor: '#fff',
//     padding: 16,
//     borderRadius: 20,
//     width: '70%',
//     alignItems: 'center',
//   },
//   sectionTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     color: '#007bff',
//     marginBottom: 10,
//     textAlign: 'center',
//   },
//   criminalImage: {
//     width: 120,
//     height: 120,
//     borderRadius: 12,
//     marginVertical: 10,
//   },
//   container: {
//     backgroundColor: '#fff',
//     borderRadius: 16,
//     padding: 16,
//     margin: 16,
//     width: '100%',
//   },
//   title: {
//     fontSize: 20,
//     fontWeight: '700',
//     color: '#007bff',
//     textAlign: 'center',
//     marginBottom: 20,
//   },
//   card: {
//     flexDirection: 'row',
//     backgroundColor: '#f8f9ff',
//     borderRadius: 12,
//     padding: 12,
//     marginBottom: 16,
//   },
//   image: {
//     width: 70,
//     height: 70,
//     borderRadius: 8,
//   },
//   info: {
//     marginLeft: 12,
//     flex: 1,
//   },
//   label: {
//     fontWeight: '600',
//     fontSize: 14,
//     color: '#333',
//   },
//   value: {
//     fontSize: 14,
//     marginBottom: 4,
//     color: '#555',
//   },
//   button: {
//     marginTop: 8,
//     backgroundColor: '#007bff',
//     paddingVertical: 6,
//     paddingHorizontal: 12,
//     borderRadius: 6,
//     alignSelf: 'flex-start',
//   },
//   buttonText: {
//     color: '#fff',
//     fontWeight: '500',
//   },
//   pagination: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     marginTop: 8,
//   },
//   pageNumber: {
//     marginHorizontal: 6,
//     fontSize: 16,
//     color: '#007bff',
//   },
//   activePage: {
//     backgroundColor: '#007bff',
//     color: '#fff',
//     paddingHorizontal: 8,
//     borderRadius: 6,
//   },
// });
