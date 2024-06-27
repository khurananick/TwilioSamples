/*
 * Twilio Serverless function to decrypt your recording in realtime.
 */
const crypto = require('node:crypto').webcrypto;

// assumes you have the decryption key saved in serverless assets
const pem = Runtime.getAssets()['/video_private_key.pem'].open()

const formatPrivateKey = () => {
  const lines = pem.split('\n');
  let encodedString = '';
  for(let i=0; i < lines.length; i++) {
    if(lines[i].indexOf('-----BEGIN PRIVATE KEY-----') < 0 && 
      lines[i].indexOf('-----END PRIVATE KEY-----') < 0) {
      encodedString += lines[i].trim();
    }
  }
  return Buffer.from(encodedString, 'base64').toString('binary');
};

const stringToArrayBuffer = byteString =>{
  const byteArray = new Uint8Array(byteString.length);
  for(let i=0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  return byteArray;
};

const importPrivateKey = () => {
  return new Promise((resolve, reject) => {
    const formattedPrivateKey = formatPrivateKey()
    const privateKeyArrayBuffer = stringToArrayBuffer(formattedPrivateKey);
    return crypto.subtle.importKey(
      "pkcs8",
      privateKeyArrayBuffer,
      { name: "RSA-OAEP", hash: {name: "SHA-256"} },
      true,
      ["decrypt"]
    )
    .then(privateKey => {
      resolve(privateKey)
    })
    .catch(err => reject(err));
 });
};

const decryptCEK = (cek, cryptoKey) => {
  return crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    stringToArrayBuffer(atob(cek))
  );
};

const importCEK = (cek) => {
  return crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM", hash: {name: "SHA-256"} },
    true,
    ["decrypt"]
  );
};

const decryptAudio = (audio, cek, iv) => {
  return new Promise((resolve, reject) => {
    const audioFile = audio
    crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: stringToArrayBuffer(atob(iv)), },
      cek,
      audioFile
    )
    .then(decryptedAudio => {
      resolve(decryptedAudio)
    })
    .catch(err => reject(err));
  });
};

const decryptFile = (audioStream, cek, iv, callback) => { 
    const audioFile = audioStream;
    const encryptedCEK = cek
    const encryptionIV = iv

    importPrivateKey()
    .then(importedKey => {
        console.log('importedKey', importedKey);

        return decryptCEK(encryptedCEK, importedKey);
    })
    .then(decryptedCEK => {
        console.log('decryptedCEK', decryptedCEK);

        return importCEK(decryptedCEK);
    })
    .then(importedCEK => {
        console.log('importedCEK', importedCEK);
        return decryptAudio(audioFile, importedCEK, encryptionIV)
    })
    .then(decryptedAudio => {
        console.log('audio decrypted!');
        callback(decryptedAudio);
    })
    .catch(err => {
        console.log('error decrypting audio', err);
    });
};

// exepects a recordingSid parameter in the query params
// for example, http://domain.com/decryptRecording?recordingSid=RE3c4c16XXX
exports.handler = async function(context, event, callback) {
    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'audio/wav');
    response.appendHeader('Access-Control-Allow-Origin', '*');

    const client = context.getTwilioClient();
    const recording = await client.recordings(event.recordingSid).fetch();

    if(recording.mediaUrl) {
        const axios = require("axios");
        const media = await axios.get(recording.mediaUrl + ".wav", {
            responseType: 'arraybuffer',
            auth: {
                username: context.ACCOUNT_SID,
                password: context.AUTH_TOKEN
            }
        });
        const data = decryptFile(media.data, recording.encryptionDetails.encrypted_cek, recording.encryptionDetails.iv, (data)=>{
            const returnedB64 = Buffer.from(data);
            response.setBody(returnedB64)
            callback(null,response)
        })
    }
}
