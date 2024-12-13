import admin from '../firebase_admin.js';
const db = admin.firestore();

// Función para obtener el siguiente ID auto-incremental
const getNextPurchaseId = async () => {
    const counterDocRef = db.collection('Counters').doc('purchase_counter');
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

// Función para guardar o actualizar datos de la compra
export const submitPurchaseData = async (req, res) => {
    try {
        // Extraer los datos enviados desde el frontend
        const {
            supplier_prod_reference,
            supplier,
            total_price,
            arrival_date,
            product_id,
            ordered_units,
        } = req.body;

        // Asignar la fecha actual al campo 'date'
        const date = new Date().toISOString(); // Esto asigna la fecha y hora actual en formato ISO

        // Validación de campos
        if (!supplier_prod_reference || !supplier || !total_price || !arrival_date || !product_id || !ordered_units) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Asegurarse de que "ordered_units" y "total_price" son números
        const totalPriceAsNumber = parseFloat(total_price);
        const orderedUnitsAsNumber = parseInt(ordered_units, 10);

        if (isNaN(totalPriceAsNumber) || isNaN(orderedUnitsAsNumber)) {
            return res.status(400).json({ message: 'El precio total y las unidades pedidas deben ser números válidos' });
        }

        // Obtener los datos del producto desde la colección 'Product'
        const productSnapshot = await db.collection('Product').where('id', '==', product_id).get();

        if (productSnapshot.empty) {
            return res.status(404).json({ message: `Producto con ID ${product_id} no encontrado.` });
        }

        const productData = productSnapshot.docs[0].data();
        const unitPrice = productData.price;

        // Validar que el precio unitario del producto es un número válido
        if (isNaN(unitPrice)) {
            return res.status(400).json({ message: 'El precio unitario del producto no es válido.' });
        }

        // Calcular el precio total esperado
        const expectedTotalPrice = unitPrice * orderedUnitsAsNumber;

        // Validar que el precio total de la compra es suficiente
        if (totalPriceAsNumber < expectedTotalPrice) {
            return res.status(400).json({
                message: `El precio total de la compra debe ser al menos ${expectedTotalPrice.toFixed(2)}, basado en el precio unitario de ${unitPrice.toFixed(2)} y ${orderedUnitsAsNumber} unidades pedidas.`,
            });
        }

        // Obtener el siguiente ID auto-incremental
        const id = await getNextPurchaseId();

        // Crear la nueva compra en la base de datos
        const docRef = await db.collection('Purchases').add({
            id,
            supplier_prod_reference,
            supplier,
            date, // Asignamos la fecha actual aquí
            total_price: totalPriceAsNumber,
            arrival_date,
            product_id,
            ordered_units: orderedUnitsAsNumber,
            arrived_units: 0, // Nuevo campo con valor inicial
        });

        // Responder con éxito al cliente
        return res.status(201).json({ message: 'Compra agregada correctamente', id: docRef.id });

    } catch (error) {
        console.error('Error al guardar o actualizar datos en Firestore:', error);
        res.status(500).json({ message: 'Error al guardar o actualizar datos' });
    }
};

export const updateArrivedUnits = async (req, res) => {
    const { id, arrived_units } = req.body;

    try {
        // Validar el valor de arrived_units
        if (isNaN(arrived_units) || arrived_units < 0) {
            return res.status(400).send({ error: 'El valor de arrived_units debe ser un número positivo.' });
        }

        // Buscar el documento en la colección 'Purchases' con el id recibido
        const snapshot = await db.collection('Purchases').where('id', '==', parseInt(id)).get();

        if (snapshot.empty) {
            return res.status(404).send({ message: `El documento con ID ${id} no existe.` });
        }

        // Obtener referencia y datos del documento de compra
        const purchaseDocRef = snapshot.docs[0].ref;
        const purchaseData = snapshot.docs[0].data();
        const product_id = purchaseData.product_id;
        const orderedUnits = purchaseData.ordered_units;
        const currentArrivedUnits = purchaseData.arrived_units || 0;

        if (arrived_units > orderedUnits) {
            return res.status(400).send({ message: 'El total de arrived_units no puede exceder las unidades ordenadas.' });
        }

        // Calcular unidades pendientes
        const pendingUnits = orderedUnits - arrived_units;

        // Actualizar arrived_units en 'Purchases'
        await purchaseDocRef.update({ arrived_units });
        
        // Actualizar el inventario en 'Product'
        const productSnapshot = await db.collection('Product').where('id', '==', product_id).get();

        if (productSnapshot.empty) {
            return res.status(404).send({ message: `Producto con ID ${product_id} no encontrado.` });
        }

        const productDocRef = productSnapshot.docs[0].ref;
        const productData = productSnapshot.docs[0].data();
        const currentInventory = productData.inventory || 0;

        const newUnitsReceived = arrived_units - currentArrivedUnits;
        const newInventory = currentInventory + newUnitsReceived;

        await productDocRef.update({
            inventory: newInventory,
            pending_units: pendingUnits // Actualizar también el campo pending_units
        });

        res.status(200).send({ message: 'Actualización exitosa de arrived_units, inventario y pending_units.' });

    } catch (error) {
        console.error('Error actualizando arrived_units, inventario o pending_units:', error);
        res.status(500).send({ error: 'Error al actualizar arrived_units, inventario o pending_units' });
    }
};
