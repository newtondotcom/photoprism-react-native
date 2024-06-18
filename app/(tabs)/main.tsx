import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Photoprism from '@/src/photoprism';
import { Album } from '../../src/types';

export default function App () {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);

  async function createAlbum() {
    const newAlbum = await photoprism.createAlbum({ Title: "test" });
    setAlbum(newAlbum);
  };

  async function fetchAlbums () {
    const albums = await photoprism.getAlbums();
    setAlbums(albums);
  };

  async function getPermission (){
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
    }
  };

  async function syncLibrary() {
    if (!album) {
      Alert.alert('Error', 'Please create an album first');
      return;
    }

    try {
        const assets = await MediaLibrary.getAssetsAsync({ mediaType: 'photo' });
        const uploadPromises = assets.assets.map(async (asset) => {
        const uri = asset.uri;
        await photoprism.uploadPhotoToAlbum([album.UID!], uri);
      });

      await Promise.all(uploadPromises);

      Alert.alert('Success', 'Library synced successfully');
    } catch (error) {
      Alert.alert('Error', 'Library sync failed');
    }
  };

  async function test () {
    const assets = await MediaLibrary.getAssetsAsync({ mediaType: 'photo' });
    console.log(assets.assets[0]);
    const albums = await photoprism.getAlbums();
  }


  useEffect(() => {
    getPermission();
  }, []);

  return (
    <View>
      <Text>Photoprism React Native Example</Text>
      <View style={{ marginVertical: 50 }}>
      <Button title="Create Album" onPress={createAlbum} />
      <Button title="Sync Library" onPress={syncLibrary} />
      <Button title="log photo" onPress={test} />
      </View>
    </View>
  );

};