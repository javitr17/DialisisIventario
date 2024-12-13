import admin from '../firebase_admin.js';
const db = admin.firestore();

// Función para obtener el siguiente ID auto-incremental
const getNextOutflowId = async () => {
    const counterDocRef = db.collection('Counters').doc('outflow_counter');
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

// Función para registrar una salida de inventario
export const submitOutflowData = async (req, res) => {
    try {
        // Extraer los datos enviados desde el frontend
        const { product_id, quantity } = req.body;

        // Asignar la fecha actual al campo 'date'
        const date = new Date().toISOString(); // Esto asigna la fecha y hora actual en formato ISO

        // Validación de campos
        if (!product_id || !quantity) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Asegurarse de que "quantity" es un número
        const quantityAsNumber = parseInt(quantity, 10);

        if (isNaN(quantityAsNumber) || quantityAsNumber <= 0) {
            return res.status(400).json({ message: 'La cantidad debe ser un número válido y mayor que 0' });
        }

        // Obtener los datos del producto desde la colección 'Product'
        const productSnapshot = await db.collection('Product').where('id', '==', product_id).get();

        if (productSnapshot.empty) {
            return res.status(404).json({ message: `Producto con ID ${product_id} no encontrado.` });
        }

        const productData = productSnapshot.docs[0].data();
        const currentInventory = productData.inventory;

        // Verificar si hay suficiente inventario para la salida
        if (currentInventory < quantityAsNumber) {
            return res.status(400).json({
                message: `No hay suficiente inventario para realizar la salida. Inventario actual: ${currentInventory}.`,
            });
        }

        // Obtener el siguiente ID auto-incremental para la salida
        const outflowId = await getNextOutflowId();

        // Crear la nueva salida en la base de datos
        const outflowDocRef = await db.collection('Outflows').add({
            id: outflowId,
            product_id,
            quantity: quantityAsNumber,
            date, // Asignamos la fecha actual aquí
        });

        // Buscar la ubicación correspondiente del producto en 'Locations'
        const locationSnapshot = await db.collection('Locations')
            .where('product_id', '==', product_id)
            .get();

        if (locationSnapshot.empty) {
            return res.status(404).json({ message: `No se encontró la ubicación para el producto con ID ${product_id}.` });
        }

        const locationDocRef = locationSnapshot.docs[0].ref;
        const locationData = locationSnapshot.docs[0].data();
        const currentLocationQuantity = locationData.quantity;

        // Verificar si hay suficientes unidades en la ubicación
        if (currentLocationQuantity < quantityAsNumber) {
            return res.status(400).json({
                message: `No hay suficientes unidades en la ubicación para realizar la salida. Unidades actuales: ${currentLocationQuantity}.`,
            });
        }

        // Restar la cantidad del inventario en la ubicación
        const newLocationQuantity = currentLocationQuantity - quantityAsNumber;

        await locationDocRef.update({
            quantity: newLocationQuantity,
        });

        // Actualizar el inventario del producto en 'Product'
        const productDocRef = productSnapshot.docs[0].ref;
        const newInventory = currentInventory - quantityAsNumber;

        await productDocRef.update({
            inventory: newInventory,
        });

        // Responder con éxito al cliente
        return res.status(201).json({ message: 'Salida de producto registrada correctamente', id: outflowDocRef.id });

    } catch (error) {
        console.error('Error al registrar salida de producto:', error);
        res.status(500).json({ message: 'Error al registrar la salida de producto' });
    }
};
