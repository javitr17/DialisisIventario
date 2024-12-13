import admin from '../firebase_admin.js';
const db = admin.firestore();

// Función para obtener el siguiente ID auto-incremental
const getNextLocationId = async () => {
    const counterDocRef = db.collection('Counters').doc('location_counter');
    const counterDoc = await counterDocRef.get();

    if (!counterDoc.exists) {
        // Si el documento no existe, creamos un nuevo contador inicializado en 1
        await counterDocRef.set({ counter: 1 });
        return 1; // Devolvemos el primer valor
    }

    const counterData = counterDoc.data();
    const currentCount = counterData?.counter;

    // Validar que el valor actual del contador es un número
    if (typeof currentCount !== 'number' || isNaN(currentCount)) {
        console.error('El valor del contador es inválido. Reestableciendo a 1.');
        await counterDocRef.set({ counter: 1 }); // Reinicializamos el contador
        return 1;
    }

    // Incrementar el contador y actualizar el documento
    const newCount = currentCount + 1;
    await counterDocRef.update({ counter: newCount });
    return newCount;
};

// Función para registrar una ubicación
export const addLocation = async (req, res) => {
    try {
        const { location, product_id, units, supplier_prod_reference } = req.body;

        // Validación de los datos del formulario
        if (!location || !product_id || !units || !supplier_prod_reference) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        const unitsAsNumber = parseInt(units, 10);
        if (isNaN(unitsAsNumber) || unitsAsNumber <= 0) {
            return res.status(400).json({ message: 'La cantidad debe ser un número mayor que 0' });
        }

        // Obtener el siguiente ID autoincremental para la ubicación
        const locationId = await getNextLocationId();

        // Agregar la nueva ubicación a Firestore
        const locationRef = await db.collection('Locations').add({
            id: locationId,                // ID autoincremental
            location,                       // Nombre de la ubicación
            product_id,                     // ID del producto
            supplier_prod_reference,        // Referencia del proveedor
            quantity: unitsAsNumber,        // Cantidad de unidades
        });

        return res.status(201).json({ message: 'Ubicación añadida correctamente', id: locationId });
    } catch (error) {
        console.error('Error al añadir ubicación:', error);
        res.status(500).json({ message: 'Error al añadir la ubicación' });
    }
};


// Función para obtener el inventario total de los productos con el mismo product_id
const getMaxInventory = async (productId) => {
    const productQuery = await db.collection('Product').where('id', '==', productId).get();
    if (productQuery.empty) {
        return 0;  // No hay productos con este product_id
    }

    let maxInventory = 0;
    productQuery.forEach(doc => {
        const productInventory = doc.data().inventory;
        maxInventory += productInventory;  // Sumar el inventario de los productos encontrados
    });

    return maxInventory;
};

// Función para actualizar la cantidad en una ubicación
export const updateLocationQuantity = async (req, res) => {
    try {
        const { id, quantity } = req.body;
        console.log('ID'+id)
        console.log('QUANTITY'+quantity)
         
        
        // Verificar si se recibió un id y cantidad válidos
        if (!id || typeof quantity !== 'number' || quantity < 0) {
            return res.status(400).json({ success: false, message: 'Datos inválidos.' });
        }
        let id_parseado=0;

        id_parseado=parseInt(id, 10);

        // Buscar la ubicación correspondiente por ID
        const locationQuery = await db.collection('Locations').where('id', '==', id_parseado).get();
        if (locationQuery.empty) {
            return res.status(404).json({ success: false, message: 'Ubicación no encontrada.' });
        }

        const locationDoc = locationQuery.docs[0];
        const productId = locationDoc.data().product_id;  // Obtener el product_id del documento Location
        console.log('ID PRODUCTO QUE SE LE PASA A LA FUNCION: '+productId)
        // Obtener el inventario máximo disponible para el producto
        const maxInventory = await getMaxInventory(productId);
        console.log('CANTIDAD PRODUCTO '+maxInventory)
        if (quantity > maxInventory) {
            return res.status(400).json({
                success: false,
                message: `La cantidad no puede ser mayor al inventario disponible. Inventario máximo: ${maxInventory}`,
            });
        }

        // Obtener el ID del documento de la ubicación
        const docId = locationDoc.id;
        console.log('ID DOCUMENTO:'+docId)
        // Actualizar la cantidad en el documento Location
        await db.collection('Locations').doc(docId).update({ quantity });

        return res.status(200).json({ success: true, message: 'Cantidad actualizada correctamente.' });
        
    } catch (error) {
        console.error('Error al actualizar la cantidad:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar la cantidad.' });
    }
};
