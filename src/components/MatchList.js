import React, { useState } from 'react';
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

const MatchList = ({ image, results, onSelectImage }) => {
  const [page, setPage] = useState(1);
  const navigation = useNavigation();

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const paginatedData = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ScrollView contentContainerStyle={styles.wrapper}>
      {/* Top: Uploaded Image Display */}
      <TouchableOpacity style={styles.leftBox}>
        <Text style={styles.sectionTitle}>Criminal Image</Text>
        {image && <Image source={{ uri: image.uri }} style={styles.criminalImage} />}
      </TouchableOpacity>

      {/* Bottom: Results List */}
      <View style={styles.container}>
        <Text style={styles.title}>Top Matches Found</Text>

        {paginatedData.map((item, index) => (
          <View key={index} style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
            <View style={styles.info}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{item.name}</Text>

              <Text style={styles.label}>Accuracy:</Text>
              <Text style={styles.value}>{(item.confidence * 100).toFixed(1)}%</Text>

              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('MugshotWebView', { url: item.url })}
              >
                <Text style={styles.buttonText}>More →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Pagination */}
        <View style={styles.pagination}>
          {[...Array(totalPages)].map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setPage(i + 1)}>
              <Text
                style={[
                  styles.pageNumber,
                  page === i + 1 && styles.activePage,
                ]}
              >
                {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default MatchList;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
  },
  leftBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    width: '70%',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 10,
    textAlign: 'center',
  },
  criminalImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginVertical: 10,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f8f9ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
  },
  value: {
    fontSize: 14,
    marginBottom: 4,
    color: '#555',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  pageNumber: {
    marginHorizontal: 6,
    fontSize: 16,
    color: '#007bff',
  },
  activePage: {
    backgroundColor: '#007bff',
    color: '#fff',
    paddingHorizontal: 8,
    borderRadius: 6,
  },
});
