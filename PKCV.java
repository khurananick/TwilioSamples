import com.twilio.http.TwilioRestClient;
import com.twilio.http.ValidationClient;
import com.twilio.rest.accounts.v1.credential.PublicKey;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.api.v2010.account.NewSigningKey;
import com.twilio.twiml.TwiMLException;
import com.twilio.type.PhoneNumber;
import org.apache.commons.codec.binary.Base64;

import java.security.KeyPair;
import java.security.KeyPairGenerator;

import java.io.*;
import java.security.*;
import java.security.spec.*;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Example {
    public static final String ACCOUNT_SID = "ACXXX";
    public static final String AUTH_TOKEN = "XXXX";
    public static PrivateKey privateKey;
    public static String keySid;
    public static String signingKeySid;
    public static String signingKeySecret;

    public static void main(String[] args) throws Exception {
		// Read Private Key.
		File filePrivateKey = new File("private.key");
    if(filePrivateKey.exists()) {
      FileInputStream fis = new FileInputStream("private.key");
      byte[] encodedPrivateKey = new byte[(int) filePrivateKey.length()];
      fis.read(encodedPrivateKey);
      fis.close();
      KeyFactory keyFactory = KeyFactory.getInstance("RSA");
      PKCS8EncodedKeySpec privateKeySpec = new PKCS8EncodedKeySpec(encodedPrivateKey);

		  privateKey = keyFactory.generatePrivate(privateKeySpec);
      keySid = new String(Files.readAllBytes(Paths.get("keySid.txt")));
      signingKeySid = new String(Files.readAllBytes(Paths.get("signingKeySid.txt")));
      signingKeySecret = new String(Files.readAllBytes(Paths.get("signingKeySecret.txt")));
    }
    else {
        // Generate public/private key pair
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair pair = keyGen.generateKeyPair();
        java.security.PublicKey pk = pair.getPublic();

        // Use the default rest client
        TwilioRestClient client =
            new TwilioRestClient.Builder(ACCOUNT_SID, AUTH_TOKEN)
                .build();

        // Create a public key and signing key using the default client
        PublicKey key = PublicKey.creator(
            Base64.encodeBase64String(pk.getEncoded())
        ).setFriendlyName("Public Key").create(client);

        NewSigningKey signingKey = NewSigningKey.creator().create(client);

        X509EncodedKeySpec x509EncodedKeySpec = new X509EncodedKeySpec(pair.getPublic().getEncoded());
        FileOutputStream fos = new FileOutputStream("public.key");
        fos.write(x509EncodedKeySpec.getEncoded());
        fos.close();

        privateKey = pair.getPrivate();
        PKCS8EncodedKeySpec pkcs8EncodedKeySpec = new PKCS8EncodedKeySpec(privateKey.getEncoded());
        fos = new FileOutputStream("private.key");
        fos.write(pkcs8EncodedKeySpec.getEncoded());
        fos.close();

        keySid = key.getSid();
        fos = new FileOutputStream("keySid.txt");
        fos.write(keySid.getBytes());
        fos.close();

        signingKeySid = signingKey.getSid();
        fos = new FileOutputStream("signingKeySid.txt");
        fos.write(signingKeySid.getBytes());
        fos.close();

        signingKeySecret = signingKey.getSecret();
        fos = new FileOutputStream("signingKeySecret.txt");
        fos.write(signingKeySecret.getBytes());
        fos.close();
    }

      // Switch to validation client as the default client
      TwilioRestClient validationClient = new TwilioRestClient.Builder(signingKeySid, signingKeySecret)
          .accountSid(ACCOUNT_SID)
          .httpClient(new ValidationClient(ACCOUNT_SID, keySid, signingKeySid, privateKey))
          .build();

        Message message = Message.creator(
            new PhoneNumber("+1908"), // to
            new PhoneNumber("+123"), // from number
            "Public Key Client Validation Test"
        ).create(validationClient);

        System.out.println(message.getSid());
    }
}
