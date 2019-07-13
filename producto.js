var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Schema = mongoose.Schema;

var ProductSchema = new Schema({
    blockchainId: Number,
    nombre: String,
    categoria: String,
    ipfsImagenHash: String,
    ipfsDescHash: String,
    horaInicioSubasta: Number,
    horaFinSubasta: Number,
    precioDeSalida: Number,
    precioComprarAhora: Number,
    condicion: Number,
    estado: Number
});

var ProductModel = mongoose.model('ProductModel', ProductSchema);

module.exports = ProductModel;