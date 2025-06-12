import Spotify from '../spotify.js';

const spotify = new Spotify();

const search = await spotify.search('Blinding Lights');
console.log(search.tracksV2.items[0].item.data);

const album = await spotify.getAlbum(search.tracksV2.items[0].item.data.albumOfTrack.uri);
console.log(album);

const artist = await spotify.getArtist(search.tracksV2.items[0].item.data.artists.items[0].uri);
console.log(artist);

const popular = await spotify.getPopular();
console.log(popular[0].data.title.translatedBaseText + ':');
console.log(popular[0].sectionItems.items[0].content.data);