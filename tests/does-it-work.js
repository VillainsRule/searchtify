import Spotify from '../spotify.js';

const spotify = new Spotify();

const search = await spotify.search('Blinding Lights');
if (search.tracksV2.items[0].item.data.name === 'Blinding Lights') console.log('Search works!');
else console.log('It doesn\'t work :(');