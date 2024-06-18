import * as FileSystem from "expo-file-system";
import dayjs from "dayjs";
import {
  Album,
  GenerateTokenResponse,
  PhotoPrismOrder,
  PhotoPrismMergedPhoto,
} from "@/scripts/types/photoprism";
import { save, getValueFor } from "@/scripts/store";
import { SearchPhotos } from "./types/photoprism";
import * as MediaLibrary from "expo-media-library";
import { Asset } from "./types/expo";

// OK - manque test dynamique token
export async function getToken() {
  let endpoint = await getValueFor("endpoint");
  let username = await getValueFor("username");
  let password = await getValueFor("password");
  let token = await getValueFor("token");
  let token_expiry_time = await getValueFor("token_expiry_time");

  if (!token_expiry_time) {
    token_expiry_time = new Date().toString();
  }

  if (token && dayjs().isBefore(token_expiry_time)) {
    return token;
  }

  try {
    let data = {
      username,
      password,
    };

    let response;
    try {
      response = await fetch(`${endpoint}/api/v1/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(data),
      });
      console.log("Token en cours de récupération : ", response);
    } catch (e) {
      console.log("Fetch error:", e);
      throw e;
    }

    let responseData: GenerateTokenResponse = await response.json();

    var now = dayjs();
    token_expiry_time = now.add(responseData.expires_in, "second").toString();
    token = responseData.access_token;
    let user_id = responseData.user.UID;

    console.log("Token récupéré : ", token);
    console.log("Token expiration : ", token_expiry_time);
    console.log("User ID : ", user_id);

    await save("token_expiry_time", token_expiry_time);
    await save("token", token);
    await save("user_id", user_id);
    return "ok";
  } catch (e) {
    console.log("Error processing token:", e);
    return "ko";
  }
}

// OK
export async function getAlbums(
  count: Number = 24,
  offset: Number = 0,
  type: string = "album",
): Promise<Album[] | null> {
  const endpoint = await getValueFor("endpoint");
  const token = await getValueFor("token");

  let query_object = {
    count: count.toString(),
    offset: offset.toString(),
    type,
    order: PhotoPrismOrder.NEWEST,
    q: null,
  };
  let query_string = new URLSearchParams(query_object).toString();
  console.log("Query string : ", query_string);
  try {
    let response = await fetch(`${endpoint}/api/v1/albums?${query_string}`, {
      method: "GET",
      headers: {
        "X-Auth-Token": token,
      },
    });

    let responseData = await response.json();
    const albums: Album[] = responseData;
    return albums;
  } catch (e) {
    console.log(e);
    console.log("Error fetching albums");
  }
}

// OK
export async function createAlbum(album: Album): Promise<Album> {
  let endpoint = await getValueFor("endpoint");
  let token = await getValueFor("token");

  try {
    let response = await fetch(`${endpoint}/api/v1/albums`, {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(album),
    });

    let responseData = await response.json();
    const dateCreated = new Date(responseData.CreatedAt);
    const author = responseData.CreatedAt;
    const threshold = 1000 * 60 * 2; // 2 minutes
    if (dateCreated.getTime() - new Date().getTime() > threshold) {
      console.log("Album déjà créé par un autre utilisateur : ", author);
    }
    return responseData;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// OK
export async function uploadPhotoToAlbum(
  albumUIDs: Array<string>,
  photoUri: string,
): Promise<Boolean> {
  let endpoint = await getValueFor("endpoint");
  let token = await getValueFor("token");
  let user_id = await getValueFor("user_id");

  const uploadId = (Math.random() + 1).toString(36).substring(6);
  const url = `${endpoint}/api/v1/users/${user_id}/upload/${uploadId}`;

  try {
    const uploadTask = FileSystem.createUploadTask(
      url,
      photoUri,
      {
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "files",
        mimeType: "image/jpeg",
        headers: {
          "X-Auth-Token": token,
          Accept: "application/json",
        },
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        const progress = parseFloat(
          (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2),
        );
      },
    );
    await uploadTask.uploadAsync();

    let response = await fetch(url, {
      method: "PUT",
      body: JSON.stringify({ albums: albumUIDs }),
      headers: {
        "X-Auth-Token": token,
      },
    });
    const ok = response.ok;
    console.log("Upload response : ", ok);
    return ok;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// OK
export async function getAlbumDetails(albumUID: string): Promise<Album | null> {
  let endpoint = await getValueFor("endpoint");
  let token = await getValueFor("token");

  try {
    let response = await fetch(`${endpoint}/api/v1/albums/${albumUID}`, {
      method: "GET",
      headers: {
        "X-Auth-Token": token,
      },
    });

    let responseData = await response.json();
    console.log("Album details : ", responseData);
    return responseData;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// OK
export async function getPhotos(
  params: SearchPhotos,
): Promise<PhotoPrismMergedPhoto[]> {
  const endpoint = await getValueFor("endpoint");
  const token = await getValueFor("token");
  let paramsL = { merged: false, ...params };
  let query_string = new URLSearchParams(paramsL).toString();
  console.log("Query string : ", query_string);

  const response = await fetch(
    `${endpoint}/api/v1/photos?${query_string}`.toString(),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const data: PhotoPrismMergedPhoto[] = await response.json();
  console.log("Photos : ", data.length);
  return data;
}

//ok
export async function batchAlbumsDelete(albumUIDs: string[]): Promise<void> {
  try {
    const endpoint = await getValueFor("endpoint");
    const token = await getValueFor("token");

    const response = await fetch(`${endpoint}/api/v1/batch/albums/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify({ albums: albumUIDs }),
    });

    if (response.ok) {
      console.log("Albums deleted successfully");
    } else {
      throw new Error("Failed to delete albums");
    }
  } catch (error) {
    console.error("Error deleting albums:", error);
    throw new Error("Failed to delete albums");
  }
}

export async function batchPhotosDelete(photosUIDs: string[]): Promise<void> {
  try {
    const endpoint = await getValueFor("endpoint");
    const token = await getValueFor("token");

    const response = await fetch(`${endpoint}/api/v1/batch/photos/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify({ photos: photosUIDs }),
    });

    if (response.ok) {
      console.log("Photos deleted successfully");
    } else {
      throw new Error("Failed to delete photos");
    }
  } catch (error) {
    console.error("Error deleting albums:", error);
    throw new Error("Failed to delete albums");
  }
}



export async function syncLibraryToAlbum() : Promise<string> {
  const albumUID : string = await getValueFor('albumUID');
  let photos: PhotoPrismMergedPhoto[];
  const count : number = 200;
  // Get the saved photos on PhotoPrism from the albums
  const params : SearchPhotos = { count : count, offset:  0, order : PhotoPrismOrder.NEWEST, public : false, s : albumUID};
  const photosFetched: PhotoPrismMergedPhoto[]= await getPhotos(params);
  photos.push(...photosFetched);
  if (photosFetched.length < count) {
    console.log("No more files to fetch")
  }

  // Get the whole library on phone
  const assets : Asset[] = await MediaLibrary.getAssetsAsync();

  // Compute the phone deleted items
  const assetDeleted : Asset[] = ;


  // Compute and upload the missing elements
  const missingAssets : Asset[] = ;

  // we need to separate the uploads into batch to not overhead the device 
  let batchSize : number = 5;
  for (let index = 0; index < missingAssets.length; index++) {
    let batchAssets : Asset[] = missingAssets.slice(index*batchSize,(index+1)*batchSize)
    const uploadPromises = batchAssets.map((asset) => {
      const uri = asset.uri;
      uploadPhotoToAlbum([albumUID], uri);
    });
    await Promise.all(uploadPromises);
  } 
  
}