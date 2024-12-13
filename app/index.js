import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import indexRoutes from './routes/index.js';
import { submitFormData } from './controllers/inventario.js'; // Importar la función del controlador de inventario
import { submitPurchaseData, updateArrivedUnits} from './controllers/compras.js'; 
import path from 'path';
import { submitOutflowData } from './controllers/salidas.js';  // Importar la función para manejar salidas
import { addLocation, updateLocationQuantity} from './controllers/ubicaciones.js';
import { registerUser, loginUser, createAdminUser, isAdmin, isAuthenticated } from './controllers/autenticacion.js';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Establecer vistas desde 'src/views'
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Usar rutas definidas
app.use(indexRoutes);

// Configurar Express para manejar JSON
app.use(express.json());

// Ruta para el formulario de inventario
app.post('/api/submit-form', submitFormData);  // Llamar a la función que guarda los datos de inventario

// Ruta para registrar una salida de inventario
app.post('/api/submit-outflow', submitOutflowData);  // Llamar a la función que maneja la salida de inventario

app.post('/api/submit-purchase', submitPurchaseData);  // Procesar datos del formulario de compras

app.put('/api/update-arrived-units', updateArrivedUnits);

app.post('/api/submit-location', addLocation);  // Llamar a la función que maneja el registro de ubicaciones

app.put('/api/update-location-quantity', updateLocationQuantity);

app.post('/api/register', registerUser); // Ruta de registro
app.post('/api/login', loginUser);       // Ruta de login

createAdminUser();
// Ruta para registrar un usuario (solo admin)
app.post('/admin/register', isAuthenticated, isAdmin, registerUser);

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, '..', 'public')));

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
