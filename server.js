var notario_virtual_artifacts = require('./build/contracts/NotarioVirtual.json')
var contract = require('truffle-contract')
var Web3 = require('web3')
var provider = new Web3.providers.HttpProvider("http://localhost:8545");
var NotarioVirtual = contract(notario_virtual_artifacts);
NotarioVirtual.setProvider(provider);

//Mongoose setup to interact with the mongodb database 
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var ProductModel = require('./producto');
mongoose.connect("mongodb://localhost:27017/notario_virtual");
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB error en la conexión:'));

// Express server which the frontend with interact with
var express = require('express');
var app = express();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.listen(3000, function () {
  console.log('¡El servidor de Notario Virtual escucha en el puerto 3000!');
});

function setupProductEventListner () {
  let productoEvento;
  NotarioVirtual.deployed().then(function (i) {
    productoEvento = i.NuevoProducto({ fromBlock: 0, toBlock: 'ultimo' });
    finalizarEvento = i.FinalizarSubasta({ fromBlock: 0, toBlock: 'ultimo' });

    productoEvento.watch(function (err, result) {
      if (err) {
        console.log(err);
        return;
      }
      guardarProducto(result.args);
    });

    finalizarEvento.watch(function (err, result) {
      if (err) {
        console.log("error");
        return;
      }
      actualizarProducto(result.args);
    });

  })
}

setupProductEventListner();

function guardarProducto (producto) {
  ProductModel.findOne({ 'blockchainId': producto._productoId.toLocaleString() }, function (err, dbProduct) {

    if (dbProduct != null) {
      return;
    }

    var p = new ProductModel({
      nombre: producto._nombre, blockchainId: producto._productoId, categoria: producto._categoria,
      ipfsImagenHash: producto._imagenLink, ipfsDescHash: producto._descLink, horaInicioSubasta: producto._horaInicioSubasta,
      horaFinSubasta: producto._horaFinSubasta, precioDeSalida: producto._precioDeSalida, precioComprarAhora: producto._precioComprarAhora, condicion: producto._condicion,
      estado: 0
    });
    p.save(function (err) {
      if (err) {
        handleError(err);
      } else {
        ProductModel.count({}, function (err, count) {
          console.log("contar es " + count);
        })
      }
    });
  })
}

function actualizarProducto (producto) {
  ProductModel.findOne({ 'blockchainId': producto._productoId.toLocaleString() }, function (err, dbProduct) {
    current_time = Math.round(new Date() / 1000);
    dbProduct.horaFinSubasta = current_time;
    dbProduct.estado = producto._estado;
    dbProduct.save(function (err) {
      if (err) {
        handleError(err);
      }
      console.log("Estado actualizado");
    });
  });
}

app.get('/productos', function (req, res) {
  current_time = Math.round(new Date() / 1000);
  query = { estado: { $eq: 0 } }

  if (Object.keys(req.query).length === 0) {
    query['horaFinSubasta'] = { $gt: current_time }
  } else if (req.query.categorias !== undefined) {
    query['horaFinSubasta'] = { $gt: current_time }
    query['categoria'] = { $eq: req.query.categorias }
  } else if (req.query.estado !== undefined) {
    if (req.query.estado == "revelar") {
      query['horaFinSubasta'] = { $lt: current_time, $gt: current_time - (60 * 10) }
    } else if (req.query.estado == "finalizado") {
      query['horaFinSubasta'] = { $lt: current_time - (60 * 10) }
      query['estado'] = { $eq: 0 }
    } else if (req.query.estado == "vendido") {
      query['estado'] = { $eq: 1 }
    }

  }

  ProductModel.find(query, null, { sort: 'horaFinSubasta' }, function (err, items) {
    res.send(items);
  })
});

app.get('/producto', function (req, res) {
  query = { blockchainId: { $eq: req.query.id } }

  ProductModel.findOne(query, null, function (err, producto) {
    console.log(producto);
    res.send(producto)
  });
});