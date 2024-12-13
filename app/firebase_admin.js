import admin from 'firebase-admin';
import serviceAccount from './credentials/inventario-dialisis-firebase-adminsdk-ooquj-169fb645d6.json' assert { type: "json" };

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export default admin;
