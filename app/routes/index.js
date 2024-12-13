import { Router } from 'express';
const router = Router();
import admin from '../firebase_admin.js';
import { addLocation } from '../controllers/ubicaciones.js';
import { isAdmin, isAuthenticated } from '../controllers/autenticacion.js';

const db = admin.firestore();

// Ruta para inicializar datos en Firestore (opcional)
router.get('/initialize', async (req, res) => {
    try {
        await createFirestoreData();
        res.send('Firestore data initialized!');
    } catch (error) {
        res.status(500).send('Error initializing Firestore data: ' + error.message);
    }
});

router.get('/', (req, res) => {
    // Redirigir automáticamente a la ruta '/inventario'
    res.redirect('/login');
});
router.get('/inventario', async (req, res) => {
    try {
        const query = req.query.q; // Obtener el valor de la búsqueda
        let products;

        // Si hay una query de búsqueda, filtrar productos
        if (query) {
            const productSnapshot = await db.collection('Product')
                .where('id', '==', query)
                .get();

            products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            // Si no hay una búsqueda, obtener todos los productos
            const productSnapshot = await db.collection('Product').get();
            products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }


        res.render('inventario', {
            page: 'inventario',
            pageTitle: 'Inventario',
            products: products, // Pasamos los productos (ya filtrados si es necesario) a la vista
            
        });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).send('Error al obtener los productos');
    }
});

router.get('/compras', async (req, res) => {
    try {
        const query = req.query.q;  // Obtener el valor de la búsqueda (ID o nombre del proveedor)
        let compras;
        let message = '';  // Inicializamos la variable message
        console.log("Consulta de búsqueda: ", query);  // Log para depurar la búsqueda

        // Si hay una query de búsqueda, filtrar compras
        if (query) {
            const purchaseSnapshot = await db.collection('Purchases')
                .where('id', '==', query)  // Filtrar por ID
                .get();
            
            console.log("Snapshot de compras filtradas por ID: ", purchaseSnapshot.docs.length);  // Ver cuántos documentos devuelve la consulta

            if (purchaseSnapshot.empty) {
                console.log("No se encontraron compras por ID, buscando por proveedor...");
                // Buscar por nombre del proveedor si no se encuentra por ID
                const purchaseBySupplierSnapshot = await db.collection('Purchases')
                    .where('supplier', '==', query)  // Filtrar por nombre del proveedor
                    .get();

                console.log("Snapshot de compras filtradas por proveedor: ", purchaseBySupplierSnapshot.docs.length);  // Ver cuántos documentos devuelve

                compras = await Promise.all(purchaseBySupplierSnapshot.docs.map(async (doc) => {
                    const purchaseData = doc.data();
                    console.log("Compra encontrada: ", purchaseData);  // Ver los datos de la compra

                    const productDoc = await db.collection('Product')
                        .doc(purchaseData.product_id)  // Buscar el producto por su ID
                        .get();
                    
                    console.log("Consulta al producto con ID:", purchaseData.product_id);  // Log para verificar el ID del producto

                    const productName = productDoc.exists ? productDoc.data().name : 'Nombre no encontrado';
                    console.log("Nombre del producto obtenido: ", productName);  // Ver el nombre del producto

                    return {
                        id: doc.id,
                        ...purchaseData,
                        product_name: productName  // Agregar nombre del producto
                    };
                }));
            } else {
                compras = await Promise.all(purchaseSnapshot.docs.map(async (doc) => {
                    const purchaseData = doc.data();
                    console.log("Compra encontrada: ", purchaseData);  // Ver los datos de la compra

                    const productDoc = await db.collection('Product')
                        .doc(purchaseData.product_id)
                        .get();

                    console.log("Consulta al producto con ID:", purchaseData.product_id);  // Log para verificar el ID del producto

                    const productName = productDoc.exists ? productDoc.data().name : 'Nombre no encontrado';
                    console.log("Nombre del producto obtenido: ", productName);  // Ver el nombre del producto

                    return {
                        id: doc.id,
                        ...purchaseData,
                        product_name: productName  // Agregar nombre del producto
                    };
                }));
            }
        } else {
            // Si no hay una búsqueda, obtener todas las compras
            const purchaseSnapshot = await db.collection('Purchases').get();
            console.log("Snapshot de todas las compras: ", purchaseSnapshot.docs.length);  // Ver cuántos documentos devuelve

            compras = await Promise.all(purchaseSnapshot.docs.map(async (doc) => {
                const purchaseData = doc.data();
                console.log("Compra encontrada: ", purchaseData);  // Ver los datos de la compra

                const productSnapshot = await db.collection('Product')
                .where('id', '==', purchaseData.product_id) // Busca donde el campo 'id' coincida con 'product_id'
                .get();


                console.log("Consulta al producto con ID:", purchaseData.product_id);  // Log para verificar el ID del producto
                
                let productName = 'Nombre no encontrado';  // Valor por defecto en caso de que no se encuentre el producto
                if (!productSnapshot.empty) {
                    productSnapshot.forEach(doc => {
                        productName = doc.data().name; // Asigna el nombre del producto
                    });
                }
                console.log("Nombre del producto obtenido: ", productName);  // Ver el nombre del producto

                return {
                    id: doc.id,
                    ...purchaseData,
                    product_name: productName  // Agregar nombre del producto
                };
            }));
        }

        // Si el número de unidades recibidas excede las unidades ordenadas
        if (req.query.error) {
            message = "El total de unidades recibidas no puede exceder las unidades ordenadas.";
        }
        
        console.log("Mensaje: ", message);  // Ver el mensaje de error

        // Pasar los datos de las compras a la vista, junto con el mensaje
        console.log("Datos de compras antes de enviar a la vista: ", compras);  // Ver los datos que se van a enviar a la vista

        res.render('compras', {
            page: 'compras',
            pageTitle: 'Compras',
            purchases: compras, // Pasamos las compras (con los nombres de los productos) a la vista
            searchQuery: query || '',
            message,  // Pasamos el mensaje a la vista
        });
    } catch (error) {
        console.error('Error al obtener compras:', error);
        res.status(500).send('Error al obtener las compras');
    }
});

router.get('/salidas', async (req, res) => {
    try {
        const query = req.query.q; // Obtener el valor de la búsqueda (ID de producto)
        let outflows;

        console.log("Busqueda en Salidas, query: ", query); // Log para depurar

        if (query) {
            const outflowSnapshot = await db.collection('Outflows')
                .where('product_id', '==', query)
                .get();

            outflows = await Promise.all(outflowSnapshot.docs.map(async (doc) => {
                const outflowData = doc.data();
                console.log("Salida encontrada: ", outflowData);

                const productSnapshot = await db.collection('Product')
                    .where('id', '==', outflowData.product_id)
                    .get();

                let productName = 'Nombre no encontrado';
                if (!productSnapshot.empty) {
                    productSnapshot.forEach(productDoc => {
                        productName = productDoc.data().name;
                    });
                }

                console.log("Nombre del producto asociado: ", productName);

                return {
                    id: doc.id,
                    ...outflowData,
                    product_name: productName // Incluye el nombre del producto
                };
            }));
        } else {
            const outflowSnapshot = await db.collection('Outflows').get();

            outflows = await Promise.all(outflowSnapshot.docs.map(async (doc) => {
                const outflowData = doc.data();
                console.log("Salida encontrada: ", outflowData);

                const productSnapshot = await db.collection('Product')
                    .where('id', '==', outflowData.product_id)
                    .get();

                let productName = 'Nombre no encontrado';
                if (!productSnapshot.empty) {
                    productSnapshot.forEach(productDoc => {
                        productName = productDoc.data().name;
                    });
                }

                console.log("Nombre del producto asociado: ", productName);

                return {
                    id: doc.id,
                    ...outflowData,
                    product_name: productName // Incluye el nombre del producto
                };
            }));
        }

        res.render('salidas', {
            pageTitle: 'Salidas',
            page: 'salidas',
            outflows, // Pasar las salidas con los nombres de los productos
            searchQuery: query || '' // Pasar el valor de búsqueda al frontend
        });
    } catch (error) {
        console.error('Error al obtener las salidas:', error);
        res.status(500).send('Error al obtener las salidas');
    }
});

// Ubicaciones
router.get('/ubicaciones', async (req, res) => {
    const query = req.query.q || ''; // Obtener el valor de la búsqueda (si existe)
    let locations;

    try {
        if (query) {
            const locationSnapshot = await db.collection('Locations')
                .where('product_id', '==', query)
                .get();

            locations = await Promise.all(locationSnapshot.docs.map(async (doc) => {
                const locationData = doc.data();
                console.log("Ubicación encontrada: ", locationData);

                const productSnapshot = await db.collection('Product')
                    .where('id', '==', locationData.product_id)
                    .get();

                let productName = 'Nombre no encontrado';
                if (!productSnapshot.empty) {
                    productSnapshot.forEach(productDoc => {
                        productName = productDoc.data().name;
                    });
                }

                console.log("Nombre del producto asociado: ", productName);

                return {
                    id: locationData.id || '', // Respetamos el valor del campo `id` en el documento
                    supplier_prod_reference: locationData.supplier_prod_reference || '',
                    product_id: locationData.product_id || '',
                    location: locationData.location || '',
                    units: locationData.quantity || 0,
                    product_name: productName // Incluye el nombre del producto
                };
            }));
        } else {
            const locationSnapshot = await db.collection('Locations').get();

            locations = await Promise.all(locationSnapshot.docs.map(async (doc) => {
                const locationData = doc.data();
                console.log("Ubicación encontrada: ", locationData);

                const productSnapshot = await db.collection('Product')
                    .where('id', '==', locationData.product_id)
                    .get();

                let productName = 'Nombre no encontrado';
                if (!productSnapshot.empty) {
                    productSnapshot.forEach(productDoc => {
                        productName = productDoc.data().name;
                    });
                }

                console.log("Nombre del producto asociado: ", productName);

                return {
                    id: locationData.id || '', // Respetamos el valor del campo `id` en el documento
                    supplier_prod_reference: locationData.supplier_prod_reference || '',
                    product_id: locationData.product_id || '',
                    location: locationData.location || '',
                    units: locationData.quantity || 0,
                    product_name: productName // Incluye el nombre del producto
                };
            }));
        }

        res.render('ubicaciones', {
            page: 'ubicaciones',
            pageTitle: 'Ubicaciones',
            locations, // Pasamos las ubicaciones obtenidas
            searchQuery: query // Pasamos el valor de búsqueda
        });
    } catch (error) {
        console.error('Error al obtener ubicaciones:', error);
        res.status(500).send('Error al obtener las ubicaciones');
    }
});

router.get('/admin/register', (req, res) => {
    if (!res.locals.isAdmin) {
        return res.status(403).send('Acceso no autorizado');
    }
    res.render('registro', { pageTitle: 'Registro de Usuario' });
});


router.get('/login', (req, res) => {
    res.render('inicio_sesion', { pageTitle: 'Iniciar Sesión' });
});



export default router;