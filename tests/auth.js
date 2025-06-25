import Spotify from '../src/index.js';

const spotify = new Spotify();

try {
    console.log('Logged in as:', await spotify.whoAmI());
} catch (e) {
    console.log(e);
}