import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import admin from '../firebase_admin.js';
import dotenv from 'dotenv';


dotenv.config({ path: '.envs' });

const db = admin.firestore();
const JWT_SECRET =  process.env.JWT_SECRET; // Cambia esto a una clave más segura y almacénala en un archivo de entorno


// Registro de usuario
export const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    try {
        // Verificar si el usuario ya existe
        const userSnapshot = await db.collection('Users').where('email', '==', email).get();
        if (!userSnapshot.empty) {
            return res.status(400).json({ message: 'El usuario ya está registrado.' });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear el usuario en Firestore
        const newUser = {
            name,
            email,
            password: hashedPassword,
            role: 'user',  // Asignar el rol "usuario" por defecto
            createdAt: new Date(),
        };
        await db.collection('Users').add(newUser);

        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
        res.redirect('/admin/register?success=true');
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error al registrar usuario.' });
    }
};


// Inicio de sesión
export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    console.log('EMAIL: '+email)
    console.log('PASSWORS: '+password)

    if (!email || !password) {
        return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
    }

    try {
        // Buscar usuario por correo
        const userSnapshot = await db.collection('Users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            return res.status(400).json({ message: 'Usuario no encontrado.' });
        }

        const userDoc = userSnapshot.docs[0];
        const user = userDoc.data();

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        // Generar token JWT
        const token = jwt.sign({ userId: userDoc.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Inicio de sesión exitoso.', token });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ message: 'Error al iniciar sesión.' });
    }
};

export const createAdminUser = async () => {
    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin';  // Contraseña predeterminada para el admin

    // Verificar si el admin ya existe
    const adminSnapshot = await db.collection('Users').where('email', '==', adminEmail).get();
    if (adminSnapshot.empty) {
        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Crear el usuario admin
        const adminUser = {
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
        };

        // Guardar el admin en Firestore
        await db.collection('Users').add(adminUser);
        console.log('Admin predefinido creado con éxito.');
    }
};

// Middleware para verificar si el usuario es admin
export const isAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Obtener el token del header

    if (!token) {
        return res.status(401).json({ message: 'Acceso no autorizado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido.' });
        }

        // Si el rol no es "admin", negar acceso
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }

        // Si es admin, pasar al siguiente middleware o ruta
        next();
    });
};

export const isAuthenticated = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.redirect('/login'); // Redirige a login si no hay autenticación
        }

        const token = authHeader.split(' ')[1];
        const userData = await admin.auth().verifyIdToken(token); // Verificar token

        if (!userData) {
            return res.redirect('/login');
        }

        // Obtener el rol del usuario desde Firestore
        const userSnapshot = await db.collection('Users').doc(userData.uid).get();
        if (!userSnapshot.exists) {
            return res.redirect('/login'); // Usuario no encontrado
        }

        req.user = { 
            uid: userData.uid, 
            email: userData.email, 
            role: userSnapshot.data().role // Asigna el rol al objeto req.user
        };

        next();
    } catch (error) {
        console.error('Error en autenticación:', error.message);
        res.redirect('/login');
    }
};




