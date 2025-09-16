// src/screens/HistoryScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { gql, useQuery } from '@apollo/client';
import { useAuth } from '../context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const GET_HISTORY = gql`
  query ($userId: String!, $pageNo: Int!, $pageSize: Int!) {
    uploadHistory(userId: $userId, pageNo: $pageNo, pageSize: $pageSize) {
      detectionResults {
        createdDate
        requestImage
        results {
          name
          url
          confidence
          imageUrl
        }
      }
      totalCount
    }
  }
`;

const PAGE_NO = 1;
const PAGE_SIZE = 20;
const SIDEBAR_WIDTH = 260;
const BREAKPOINT = 768; // <768 = mobile, >=768 = tablet/desktop

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const isLarge = width >= BREAKPOINT;

  const { user } = useAuth();
  const [userId, setUserId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = useNavigation();

  // Extract userId from JWT
  useEffect(() => {
    const token = user?.token?.token;
    try {
      const decoded = token ? jwtDecode(token) : null;
      setUserId(decoded?.id || decoded?.userId || decoded?.sub || null);
      // console.log('Decoded token:', decoded);
    } catch (e) {
      console.error('JWT decode error:', e);
      setUserId(null);
    }
  }, [user]);

  const { data, loading, error, refetch } = useQuery(GET_HISTORY, {
    variables: { userId, pageNo: PAGE_NO, pageSize: PAGE_SIZE },
    skip: !userId,
    fetchPolicy: 'no-cache',
    onError: e => {
      console.log('GraphQL Error Details:');
      console.log('message:', e.message);
      console.log('graphQLErrors:', e.graphQLErrors);
      console.log('networkError:', e.networkError);
    },
    onCompleted: d => console.log(' GET_HISTORY data:', d),
  });

  useEffect(() => {
    if (userId) {
      refetch({ userId, pageNo: PAGE_NO, pageSize: PAGE_SIZE });
    }
  }, [userId, refetch]);

  const history = data?.uploadHistory?.detectionResults || [];
  const selectedItem = history[selectedIndex];

  const formatDate = dateStr => new Date(dateStr).toLocaleString();

  // Empty state block (shows when no history)
  const EmptyState = (
    <View style={styles.emptyWrap}>
      {/* If you have an illustration, uncomment and add your asset: */}
      {/* <Image
        source={require('../assets/no-history.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      /> */}
      <Text style={styles.emptyTitle}> No history yet</Text>
      <Text style={styles.emptySubtitle}>
        Upload an image to start your first search. Your past results will appear here.
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Home')}
        style={styles.emptyButton}
        activeOpacity={0.9}
      >
        <Text style={styles.emptyButtonText}>Go to Upload</Text>
      </TouchableOpacity>
    </View>
  );

  // Sidebar block
  const Sidebar = (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Recent Searches</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {history.map((item, index) => {
          const selected = selectedIndex === index;
          return (
            <Pressable
              key={index}
              onPress={() => {
                setSelectedIndex(index);
                setSidebarOpen(false);
              }}
              style={[
                styles.sidebarItem,
                selected && styles.sidebarItemSelected,
              ]}
            >
              <Text style={styles.sidebarItemHeading}>Search #{index + 1}</Text>
              <Text style={styles.sidebarItemDate}>
                {formatDate(item.createdDate)}
              </Text>
              <Text style={styles.sidebarItemCount}>
                {item.results?.length || 0} results
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Guards
  if (!userId)
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.message}> Please log in again.</Text>
      </SafeAreaView>
    );

  if (loading)
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );

  if (error)
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: 'center', padding: 16 }]}
      >
        <Text style={styles.message}> Error: {error.message}</Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.container}>
        {/* Layout wrapper: row on large screens; single column on mobile */}
        <View style={[styles.row, isLarge && { paddingLeft: SIDEBAR_WIDTH }]}>
          {/* Fixed sidebar (visible on large screens) */}
          {isLarge && <View style={[styles.sidebarFixed]}>{Sidebar}</View>}

          {/* Floating toggle button (mobile only) */}
          {!isLarge && history.length > 0 && (
            <TouchableOpacity
              onPress={() => setSidebarOpen(v => !v)}
              style={[styles.fab, sidebarOpen && styles.fabClose]}
              accessibilityLabel="Toggle recent searches"
            >
              <Text style={styles.fabText}>{sidebarOpen ? '×' : '≡'}</Text>
            </TouchableOpacity>
          )}

          {/* Mobile overlay sidebar */}
          {!isLarge && sidebarOpen && (
            <>
              <Pressable
                style={styles.overlay}
                onPress={() => setSidebarOpen(false)}
              />
              <View style={styles.sidebarOverlay}>{Sidebar}</View>
            </>
          )}

          {/* Main content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {history.length === 0 ? (
              EmptyState
            ) : selectedItem ? (
              <>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Search Details</Text>
                    <Text style={styles.date}>
                      Performed on: {formatDate(selectedItem.createdDate)}
                    </Text>
                  </View>
                  {!!selectedItem.requestImage && (
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${selectedItem.requestImage}`,
                      }}
                      style={styles.requestThumb}
                    />
                  )}
                </View>

                {selectedItem.results?.map((r, i) => (
                  <View key={i} style={styles.resultCard}>
                    {/* Left: Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{r.name}</Text>
                      <Text style={styles.resultConfidence}>
                        Confidence: {(r.confidence * 100).toFixed(2)}%
                      </Text>

                      {!!r.url && (
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('MugshotWebView', { url: r.url })
                          }
                          style={{ marginTop: 6 }}
                        >
                          <Text style={styles.resultUrl}>View Profile</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Right: Image */}
                    {!!r.imageUrl && (
                      <Image
                        source={{ uri: r.imageUrl }}
                        style={styles.resultImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.message}>Select a search to view details</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffffff', paddingBottom: 12 },
  row: { flex: 1 },

  // Sidebar (shared)
  sidebar: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  sidebarTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 16,
  },
  sidebarItem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  sidebarItemSelected: { backgroundColor: 'rgba(255,255,255,0.16)' },
  sidebarItemHeading: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 13,
  },
  sidebarItemDate: { color: '#dbeafe', fontSize: 12, marginBottom: 4 },
  sidebarItemCount: { color: '#e5e7eb', fontSize: 12 },

  // Fixed sidebar (desktop/tablet)
  sidebarFixed: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#0b62ff',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
  },

  // Mobile overlay sidebar
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#0b62ff',
    zIndex: 30,
    elevation: 30,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 20,
  },

  // FAB toggle
  fab: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    zIndex: 40,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0b62ff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabClose: { backgroundColor: '#ef4444' },
  fabText: { color: '#fff', fontSize: 26, lineHeight: 26, fontWeight: '700' },

  // Content
  content: {
    flex: 1,
    padding: 16,
    marginLeft: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  date: { color: '#6b7280', marginTop: 4 },
  requestThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultImage: {
    width: 70,
    height: 70,
    borderRadius: 6,
    marginLeft: 12,
    backgroundColor: '#f3f4f6',
  },
  resultName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  resultConfidence: { fontSize: 13, color: '#374151', marginTop: 2 },
  resultUrl: { color: '#0b62ff', fontSize: 14, fontWeight: '600' },

  message: {
    color: '#000000ff',
    textAlign: 'center',
    marginTop: 20,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyImage: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptyButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#0C66E4',
    borderRadius: 6,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});


// // src/screens/HistoryScreen.js
// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   Image,
//   TouchableOpacity,
//   ActivityIndicator,
//   Linking,
//   Pressable,
//   StatusBar,
//   useWindowDimensions,
// } from 'react-native';
// import { gql, useQuery } from '@apollo/client';
// import { useAuth } from '../context/AuthContext';
// import { jwtDecode } from 'jwt-decode';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useNavigation } from '@react-navigation/native';
// import Navbar from '../components/Navbar';

// const GET_HISTORY = gql`
//   query ($userId: String!, $pageNo: Int!, $pageSize: Int!) {
//     uploadHistory(userId: $userId, pageNo: $pageNo, pageSize: $pageSize) {
//       detectionResults {
//         createdDate
//         requestImage
//         results {
//           name
//           url
//           confidence
//           imageUrl
//         }
//       }
//       totalCount
//     }
//   }
// `;

// const PAGE_NO = 1;
// const PAGE_SIZE = 20;
// const SIDEBAR_WIDTH = 260;
// const BREAKPOINT = 768; // <768 = mobile, >=768 = tablet/desktop

// export default function HistoryScreen() {
//   const { width } = useWindowDimensions();
//   const isLarge = width >= BREAKPOINT;

//   const { user } = useAuth();
//   const [userId, setUserId] = useState(null);
//   const [selectedIndex, setSelectedIndex] = useState(0);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   const navigation = useNavigation();
//   // Extract userId from JWT
//   useEffect(() => {
//     const token = user?.token?.token;
//     try {
//       const decoded = token ? jwtDecode(token) : null;
//       setUserId(decoded?.id || null);
//       console.log('Decoded token:', decoded);
//     } catch (e) {
//       console.error('JWT decode error:', e);
//       setUserId(null);
//     }
//   }, [user]);

//   const { data, loading, error, refetch } = useQuery(GET_HISTORY, {
//     variables: { userId, pageNo: PAGE_NO, pageSize: PAGE_SIZE },
//     skip: !userId,
//     fetchPolicy: 'no-cache',
//     onError: e => {
//       console.log('GraphQL Error Details:');
//       console.log('message:', e.message);
//       console.log('graphQLErrors:', e.graphQLErrors);
//       console.log('networkError:', e.networkError);
//     },
//     onCompleted: d => console.log(' GET_HISTORY data:', d),
//   });

//   useEffect(() => {
//     if (userId) {
//       refetch({ userId, pageNo: PAGE_NO, pageSize: PAGE_SIZE });
//     }
//   }, [userId, refetch]);

//   const history = data?.uploadHistory?.detectionResults || [];
//   const selectedItem = history[selectedIndex];

//   const formatDate = dateStr => new Date(dateStr).toLocaleString();

//   // UI blocks
//   const Sidebar = (
//     <View style={styles.sidebar}>
//       <Text style={styles.sidebarTitle}>Recent Searches</Text>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         {history.map((item, index) => {
//           const selected = selectedIndex === index;
//           return (
//             <Pressable
//               key={index}
//               onPress={() => {
//                 setSelectedIndex(index);
//                 setSidebarOpen(false);
//               }}
//               style={[
//                 styles.sidebarItem,
//                 selected && styles.sidebarItemSelected,
//               ]}
//             >
//               <Text style={styles.sidebarItemHeading}>Search #{index + 1}</Text>
//               <Text style={styles.sidebarItemDate}>
//                 {formatDate(item.createdDate)}
//               </Text>
//               <Text style={styles.sidebarItemCount}>
//                 {item.results?.length || 0} results
//               </Text>
//             </Pressable>
//           );
//         })}
//       </ScrollView>
//     </View>
//   );

//   if (!userId)
//     return (
//       <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
//         <Text style={styles.message}> Please log in again.</Text>
//       </SafeAreaView>
//     );

//   if (loading)
//     return (
//       <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
//         <ActivityIndicator size="large" />
//       </SafeAreaView>
//     );

//   if (error)
//     return (
//       <SafeAreaView
//         style={[styles.container, { justifyContent: 'center', padding: 16 }]}
//       >
//         <Text style={styles.message}> Error: {error.message}</Text>
//       </SafeAreaView>
//     );

//   // return (
//   //   <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
//   //     <StatusBar barStyle="light-content" backgroundColor="black" />
//   //     <View style={styles.container}>
//   //       <View style={[styles.row, isLarge && { paddingLeft: SIDEBAR_WIDTH }]}>
//   //         {/* Fixed sidebar (visible on large screens) */}
//   //         {isLarge && <View style={[styles.sidebarFixed]}>{Sidebar}</View>}

//   //         {/* Floating toggle button (mobile only) */}
//   //         {!isLarge && (
//   //           <TouchableOpacity
//   //             onPress={() => setSidebarOpen(v => !v)}
//   //             style={[styles.fab, sidebarOpen && styles.fabClose]}
//   //             accessibilityLabel="Toggle recent searches"
//   //           >
//   //             <Text style={styles.fabText}>{sidebarOpen ? '×' : '≡'}</Text>
//   //           </TouchableOpacity>
//   //         )}

//   //         {/* Mobile overlay sidebar */}
//   //         {!isLarge && sidebarOpen && (
//   //           <>
//   //             <Pressable
//   //               style={styles.overlay}
//   //               onPress={() => setSidebarOpen(false)}
//   //             />
//   //             <View style={styles.sidebarOverlay}>{Sidebar}</View>
//   //           </>
//   //         )}

//   //         {/* Main content */}
//   //         <ScrollView
//   //           style={styles.content}
//   //           showsVerticalScrollIndicator={false}
//   //         >
//   //           {selectedItem ? (
//   //             <>
//   //               <View style={styles.headerRow}>
//   //                 <View style={{ flex: 1 }}>
//   //                   <Text style={styles.title}>Search Details</Text>
//   //                   <Text style={styles.date}>
//   //                     Performed on: {formatDate(selectedItem.createdDate)}
//   //                   </Text>
//   //                 </View>
//   //                 {!!selectedItem.requestImage && (
//   //                   <Image
//   //                     source={{
//   //                       uri: `data:image/jpeg;base64,${selectedItem.requestImage}`,
//   //                     }}
//   //                     style={styles.requestThumb}
//   //                   />
//   //                 )}
//   //               </View>

//   //               {selectedItem.results?.map((r, i) => (
//   //                 <View key={i} style={styles.resultCard}>
//   //                   {/* Left: Info */}
//   //                   <View style={{ flex: 1 }}>
//   //                     <Text style={styles.resultName}>{r.name}</Text>
//   //                     <Text style={styles.resultConfidence}>
//   //                       Confidence: {(r.confidence * 100).toFixed(2)}%
//   //                     </Text>

//   //                     {!!r.url && (
//   //                       <TouchableOpacity
//   //                         onPress={() =>
//   //                           navigation.navigate('MugshotWebView', {
//   //                             url: r.url,
//   //                           })
//   //                         }
//   //                         style={{ marginTop: 6 }}
//   //                       >
//   //                         <Text style={styles.resultUrl}>View Profile</Text>
//   //                       </TouchableOpacity>
//   //                     )}
//   //                   </View>

//   //                   {/* Right: Image */}
//   //                   {!!r.imageUrl && (
//   //                     <Image
//   //                       source={{ uri: r.imageUrl }}
//   //                       style={styles.resultImage}
//   //                       resizeMode="cover"
//   //                     />
//   //                   )}
//   //                 </View>
//   //               ))}
//   //             </>
//   //           ) : (
//   //             <Text style={styles.message}>
//   //                Select a search to view details
//   //             </Text>
//   //           )}
//   //         </ScrollView>
//   //       </View>
//   //     </View>
//   //   </SafeAreaView>
//   // );
//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
//       <StatusBar barStyle="light-content" backgroundColor="white" />
//       {/* <Navbar /> */}

//       <View style={styles.container}>
//         {/* Layout: row on large screens; single column on mobile */}
//         <View style={[styles.row, isLarge && { paddingLeft: SIDEBAR_WIDTH }]}>
//           {/* Fixed sidebar (visible on large screens) */}
//           {isLarge && <View style={[styles.sidebarFixed]}>{Sidebar}</View>}

//           {/* Floating toggle button (mobile only) */}
//           {!isLarge && (
//             <TouchableOpacity
//               onPress={() => setSidebarOpen(v => !v)}
//               style={[styles.fab, sidebarOpen && styles.fabClose]}
//               accessibilityLabel="Toggle recent searches"
//             >
//               <Text style={styles.fabText}>{sidebarOpen ? '×' : '≡'}</Text>
//             </TouchableOpacity>
//           )}

//           {/* Mobile overlay sidebar */}
//           {!isLarge && sidebarOpen && (
//             <>
//               <Pressable
//                 style={styles.overlay}
//                 onPress={() => setSidebarOpen(false)}
//               />
//               <View style={styles.sidebarOverlay}>{Sidebar}</View>
//             </>
//           )}

//           {/* Main content */}
//           <ScrollView
//             style={styles.content}
//             showsVerticalScrollIndicator={false}
//           >
//             {selectedItem ? (
//               <>
//                 <View style={styles.headerRow}>
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.title}>Search Details</Text>
//                     <Text style={styles.date}>
//                       Performed on: {formatDate(selectedItem.createdDate)}
//                     </Text>
//                   </View>
//                   {!!selectedItem.requestImage && (
//                     <Image
//                       source={{
//                         uri: `data:image/jpeg;base64,${selectedItem.requestImage}`,
//                       }}
//                       style={styles.requestThumb}
//                     />
//                   )}
//                 </View>

//                 {selectedItem.results?.map((r, i) => (
//                   <View key={i} style={styles.resultCard}>
//                     {/* Left: Info */}
//                     <View style={{ flex: 1 }}>
//                       <Text style={styles.resultName}>{r.name}</Text>
//                       <Text style={styles.resultConfidence}>
//                         Confidence: {(r.confidence * 100).toFixed(2)}%
//                       </Text>

//                       {!!r.url && (
//                         <TouchableOpacity
//                           onPress={() =>
//                             navigation.navigate('MugshotWebView', {
//                               url: r.url,
//                             })
//                           }
//                           style={{ marginTop: 6 }}
//                         >
//                           <Text style={styles.resultUrl}>View Profile</Text>
//                         </TouchableOpacity>
//                       )}
//                     </View>

//                     {/* Right: Image */}
//                     {!!r.imageUrl && (
//                       <Image
//                         source={{ uri: r.imageUrl }}
//                         style={styles.resultImage}
//                         resizeMode="cover"
//                       />
//                     )}
//                   </View>
//                 ))}
//               </>
//             ) : (
//               <Text style={styles.message}>
//                 No History
//               </Text>
//             )}
//           </ScrollView>
//         </View>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#ffffffff', paddingBottom: 12 },
//   row: { flex: 1 },

//   // Sidebar (shared)
//   sidebar: {
//     flex: 1,
//     paddingVertical: 14,
//     paddingHorizontal: 12,
//   },
//   sidebarTitle: {
//     color: '#fff',
//     fontWeight: '700',
//     marginBottom: 10,
//     fontSize: 16,
//   },
//   sidebarItem: {
//     backgroundColor: 'rgba(255,255,255,0.08)',
//     padding: 12,
//     borderRadius: 10,
//     marginBottom: 10,
//   },
//   sidebarItemSelected: { backgroundColor: 'rgba(255,255,255,0.16)' },
//   sidebarItemHeading: {
//     color: '#fff',
//     fontWeight: '600',
//     marginBottom: 2,
//     fontSize: 13,
//   },
//   sidebarItemDate: { color: '#dbeafe', fontSize: 12, marginBottom: 4 },
//   sidebarItemCount: { color: '#e5e7eb', fontSize: 12 },

//   // Fixed sidebar (desktop/tablet)
//   sidebarFixed: {
//     position: 'absolute',
//     left: 0,
//     top: 0,
//     bottom: 0,
//     width: SIDEBAR_WIDTH,
//     backgroundColor: '#0b62ff',
//     borderRightWidth: 1,
//     borderRightColor: 'rgba(255,255,255,0.15)',
//   },

//   // Mobile overlay sidebar
//   sidebarOverlay: {
//     position: 'absolute',
//     top: 0,
//     bottom: 0,
//     left: 0,
//     width: SIDEBAR_WIDTH,
//     backgroundColor: '#0b62ff',
//     zIndex: 30,
//     elevation: 30,
//   },
//   overlay: {
//     position: 'absolute',
//     top: 0,
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: 'rgba(0,0,0,0.45)',
//     zIndex: 20,
//   },

//   // FAB toggle
//   fab: {
//     position: 'absolute',
//     left: 16,
//     bottom: 24,
//     zIndex: 40,
//     width: 52,
//     height: 52,
//     borderRadius: 26,
//     backgroundColor: '#0b62ff',
//     alignItems: 'center',
//     justifyContent: 'center',
//     elevation: 6,
//   },
//   fabClose: { backgroundColor: '#ef4444' },
//   fabText: { color: '#fff', fontSize: 26, lineHeight: 26, fontWeight: '700' },

//   // Content
//   content: {
//     flex: 1,
//     padding: 16,
//     marginLeft: 0,
//     // main card-like background to mimic web
//     backgroundColor: '#ffffff',
//     borderTopLeftRadius: 18,
//     borderTopRightRadius: 18,
//   },
//   headerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 14,
//     gap: 12,
//   },
//   title: { fontSize: 18, fontWeight: '700', color: '#111827' },
//   date: { color: '#6b7280', marginTop: 4 },
//   requestThumb: {
//     width: 80,
//     height: 80,
//     borderRadius: 8,
//     backgroundColor: '#e5e7eb',
//   },

//   resultCard: {
//     flexDirection: 'row', // 🟢 Put text and image side by side
//     alignItems: 'center', // 🟢 Vertically center them
//     justifyContent: 'space-between',
//     backgroundColor: '#fff',
//     borderRadius: 12,
//     padding: 14,
//     marginBottom: 10,
//     borderWidth: 1,
//     borderColor: '#e5e7eb',
//   },
//   resultImage: {
//     width: 70,
//     height: 70,
//     borderRadius: 6,
//     marginLeft: 12,
//     backgroundColor: '#f3f4f6',
//   },
//   resultName: { fontSize: 16, fontWeight: '600', color: '#111827' },
//   resultConfidence: { fontSize: 13, color: '#374151', marginTop: 2 },
//   resultUrl: { color: '#0b62ff', fontSize: 14, fontWeight: '600' },

//   message: {
//     color: '#000000ff',
//     justifyContent: 'center',
//     textAlign: 'center',
//     marginTop: 20,
//   },
// });
