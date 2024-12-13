import admin from '../firebase_admin.js';
const db = admin.firestore();

// Función para guardar o actualizar datos del formulario
export const submitFormData = async (req, res) => {
    try {
        // Extraer los datos enviados desde el frontend
        const { id, name, type, subtype, bar_code, batch, expiry_date, price, units } = req.body;

        // Validación de campos
        if (!id || !name || !type || !subtype || !bar_code || !batch || !expiry_date || !price || units === undefined) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Asegurarse de que "units" es un número
        const unitsAsNumber = parseInt(units, 10);
        if (isNaN(unitsAsNumber)) {
            return res.status(400).json({ message: 'El valor de las unidades debe ser un número' });
        }

        // Buscar si el producto con el mismo id ya existe en la base de datos
        const productSnapshot = await db.collection('Product').where('id', '==', id).get();
        const pending_units=0;                                
        if (productSnapshot.empty) {
            // Si el producto no existe, crear un nuevo producto
            const docRef = await db.collection('Product').add({
                id,
                name,
                type,
                subtype,
                bar_code,
                batch,
                expiry_date,
                price,
                pending_units,
                inventory: unitsAsNumber,  // El inventario será igual a las unidades introducidas
            });
            // Responder con éxito al cliente
            return res.status(201).json({ message: 'Producto agregado correctamente', id: docRef.id });
        } else {
            // Si el producto ya existe, actualizamos solo el inventario
            const productDoc = productSnapshot.docs[0]; // Obtenemos el primer documento con ese id
            const productData = productDoc.data();

            // Calcular el nuevo inventario sumando las unidades introducidas por el usuario
            const newInventory = productData.inventory + unitsAsNumber; // Sumar las unidades al inventario actual

            // Solo actualizamos el campo inventory
            await productDoc.ref.update({
                inventory: newInventory,  // Actualizar solo el inventario
            });

            // Responder con éxito al cliente
            return res.status(200).json({ message: 'Inventario actualizado correctamente', id: productDoc.id });
        }
    } catch (error) {
        console.error('Error al guardar o actualizar datos en Firestore:', error);
        res.status(500).json({ message: 'Error al guardar o actualizar datos' });
    }
};

