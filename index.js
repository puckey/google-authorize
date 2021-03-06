const fs = require('fs');
const readline = require('readline');
const GoogleAuth = require('google-auth-library');

/**
 * Returns an authorized OAuth2 client back to the requester to facilitiate
 * interaction with Google APIs.
 *
 * @class GoogleAuthorize
 */
class GoogleAuthorize {
  /**
   * Default constructor
   * @param {Array} scopes An array representing the scopes
   *  to authorize for the oauth2Client. Example ['spreadsheets'] would
   *  correlate with ..googleapis.com/auth/spreadsheets.
   * @param {String} credentialsPath Where your Google credentials.json lives.
   *  Defaults to 'credentials.json' which is relative to your execution
   *  context.
   */
  constructor(scopes, credentialsPath) {
    // If modifying these scopes, delete your previously saved credentials
    // at ~/.credentials/credentials.json
    if (!Array.isArray(scopes)) {
      throw new Error('Initialize with array of scope names.');
    }
    this.SCOPES = ((scopes) => {
      const _scopes = [];
      (scopes || []).forEach((scope) => {
        _scopes.push('https://www.googleapis.com/auth/' + scope);
      });
      return _scopes;
    })(scopes);
    this.TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
      process.env.USERPROFILE) + '/.credentials/';
    this.TOKEN_PATH = this.TOKEN_DIR + 'googleapis.json';
    this.credentialsPath = credentialsPath || 'credentials.json';
  }
  /**
   * Returns a promise representing the authorization process. If successful,
   * we resolve and pass an authorized oauth2 client which can then be used to
   * interact with the google apis.
   *
   * @return {Promise} The promise returned representing the auth process.
   */
  authorize() {
    return new Promise((resolve, reject) => {
      // Load client secrets from a local file.
      fs.readFile(this.credentialsPath,
        function processClientSecrets(err, content) {
          if (err) {
            console.error('Error loading credentials.json file: ' + err);
            reject(err);
            return;
          }
          // Authorize a client with the loaded credentials, then call the
          // Google Sheets API.
          resolve(this._authorize(JSON.parse(content)));
        }.bind(this));
    });
  }
  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   *
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   * @return {Promise}
   */
  _authorize(credentials) {
    const clientSecret = credentials.installed.client_secret;
    const clientId = credentials.installed.client_id;
    const redirectUrl = credentials.installed.redirect_uris[0];
    const auth = new GoogleAuth();
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    return new Promise((resolve, reject) => {
      // Check if we have previously stored a token.
      fs.readFile(this.TOKEN_PATH, (err, token) => {
        if (err) {
          this.getNewToken(oauth2Client, resolve, reject);
        } else {
          oauth2Client.credentials = JSON.parse(token);
          resolve(oauth2Client);
        }
      });
    });
  }
  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   *
   * @param {google.auth.OAuth2} oauth2Client The OAuth2 client
   *  to get token for.
   * @param {function} resolve Returns a Promise object that is
   *  resolved with the given value
   * @param {function} reject Returns a Promise object that is
   *  rejected with the given reason.
   */
  getNewToken(oauth2Client, resolve, reject) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oauth2Client.getToken(code, (err, token) => {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          reject(err);
          return;
        }
        oauth2Client.credentials = token;
        this.storeToken(token);
        resolve(oauth2Client);
      });
    });
  }
  /**
   * Store token to disk be used in later program executions.
   *
   * @param {Object} token The token to store to disk.
   */
  storeToken(token) {
    try {
      fs.mkdirSync(this.TOKEN_DIR);
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
    fs.writeFile(this.TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) throw err;
    });
    console.log('Token stored to ' + this.TOKEN_PATH);
  }
}
module.exports = GoogleAuthorize;
