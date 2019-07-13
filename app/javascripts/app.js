// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3 } from 'web3';
import { default as contract } from 'truffle-contract'
import notario_virtual_artifacts from '../../build/contracts/NotarioVirtual.json'

var NotarioVirtual = contract(notario_virtual_artifacts);

const ipfsAPI = require('ipfs-api');
const ethUtil = require('ethereumjs-util');

const ipfs = ipfsAPI({ host: 'localhost', port: '5001', protocol: 'http' });

const offchainServer = "http://localhost:3000";
const categorias = ["Coches", "Motor y Accesorios", "Electrónica", "Deporte y Ocio", "Muebles, Deco y Jardín", "Consolas y Videojuegos", "Libros, Películas y Música",
  "Moda y Accesorios", "Niños y Bebés", "Inmobiliaria", "Electrodomésticos", "Servicios", "Otros"];

var dinero = 0;
var contar = 0;

var xhReq = new XMLHttpRequest();
xhReq.open("GET", "https://api.coinmarketcap.com/v2/ticker/1027/?convert=EUR", false);
xhReq.send(null);
var jsonObject = JSON.parse(xhReq.responseText);
var precioEthAEur = jsonObject.data.quotes.EUR.price;

function convertirAEuros (ether) {
  return (precioEthAEur * ether);
}



window.App = {
  start: function () {
    var self = this;
    var reader;
    NotarioVirtual.setProvider(web3.currentProvider);
    renderStore();

    $("#bidding").submit(function (event) {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para pujar por los productos de la tienda.").show();
      }
      $("#msg").hide();
      let amount = $("#bidAmount").val();
      let sendAmount = $("#bidSendAmount").val();
      let secretText = $("#secret-text").val();
      let sealedBid = '0x' + ethUtil.keccak256(web3.toWei(amount, 'ether') + secretText).toString('hex');
      let productId = $("#product-id").val();
      console.log(sealedBid + " for " + productId);
      NotarioVirtual.deployed().then(function (i) {
        $("#msg").html("Su oferta ha sido enviada. Espere unos segundos para la confirmación.").show();
        i.pujar(parseInt(productId), sealedBid, { value: web3.toWei(sendAmount), from: web3.eth.accounts[0], gas: 440000 }).then(
          function (f) {
            $("#msg").html("¡Su oferta ha sido enviada exitosamente!");
            console.log(f);
            setTimeout(function () { location.reload() }, 2000);
          }
        ).catch(function (e) {
          console.log(e);
          $("#error").show();
          $("#error").html("No has podido enviar su oferta, vuelve a intentarlo.");
          setTimeout(function () { location.reload() }, 2000);
        })
      });
      event.preventDefault();

    });

    $("#revealing").submit(function (event) {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder revelar tus pujas.").show();
      }
      $("#msg").hide();
      let amount = $("#actual-amount").val();
      let secretText = $("#reveal-secret-text").val();
      let productId = $("#product-id").val();
      NotarioVirtual.deployed().then(function (i) {
        $("#msg").html("Su transacción ha sido enviada. Espere unos segundos para la confirmación.").show();
        i.revelarOferta(parseInt(productId), web3.toWei(amount).toString(), secretText, { from: web3.eth.accounts[0], gas: 4400000 }).then(
          function (f) {
            $("#msg").show();
            $("#msg").html("¡Su oferta ha sido revelada con éxito!");
            console.log(f);
            setTimeout(function () { location.reload() }, 2000);
          }
        ).catch(function (e) {
          console.log(e);
          $("#error").show();
          $("#error").html("No se ha podido revelar su oferta, vuelva a intentarlo.");
          setTimeout(function () { location.reload() }, 2000);
        })
      });
      event.preventDefault();

    });

    $("#buy-now").submit(function (event) {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder comprar los productos de la tienda.").show();
      }
      $("#msg").hide();
      let sendAmount = $("#buy-now-price").val();
      let productId = $("#product-id").val();
      NotarioVirtual.deployed().then(function (i) {
        $("#msg").html("Su transacción ha sido enviada. Espere unos segundos para la confirmación.").show();
        i.comprarProducto(parseInt(productId), { from: web3.eth.accounts[0], gas: 4400000, value: sendAmount }).then(
          function (f) {
            $("#msg").show();
            $("#msg").html("¡Has comprado exitosamente el producto!");
            setTimeout(function () { location.reload() }, 2000);
          }
        ).catch(function (e) {
          console.log(e);
          $("#error").show();
          $("#error").html("No has podido comprar el producto, vuelva a intentarlo.");
          setTimeout(function () { location.reload() }, 2000);
        })
      });
      event.preventDefault();

    });

    $("#finalize-auction").submit(function (event) {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder finalizar una subasta.").show();
      }

      $("#msg").hide();
      let productId = $("#product-id2").val();
      let sendAmount = $("#deposito-arbitro").val();;
      NotarioVirtual.deployed().then(function (i) {
        i.finalizarSubasta(parseInt(productId), { from: web3.eth.accounts[0], gas: 4400000, value: sendAmount }).then(
          function (f) {
            $("#msg").show();
            $("#msg").html("La subasta ha sido finalizada y el ganador declarado.");
            console.log(f)
            setTimeout(function () { location.reload() }, 3000);
          }
        ).catch(function (e) {
          console.log("Error");
          $("#msg").show();
          $("#msg").html("La subasta no puede ser finalizada por el comprador o el vendedor, solo un tercero puede finalizarla.");
        })
      });
      event.preventDefault();

    });

    $("#add-item-to-store").submit(function (event) {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder añadir productos a la tienda.").show();
      }
      const req = $("#add-item-to-store").serialize();
      let params = JSON.parse('{"' + req.replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
      let decodedParams = {}
      Object.keys(params).forEach(function (v) {
        decodedParams[v] = decodeURIComponent(decodeURI(params[v]));
      });
      saveProduct(reader, decodedParams);
      event.preventDefault();

    });

    $("#product-image").change(function (event) {
      const file = event.target.files[0]
      reader = new window.FileReader()
      reader.readAsArrayBuffer(file)
    });

    $(".category-link").click(function () {
      renderProducts("product-list", { categorias: $(this).text() });
    });

    $("#release-funds").click(function () {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder añadir productos a la tienda.").show();
      }
      let productId = new URLSearchParams(window.location.search).get('id');
      NotarioVirtual.deployed().then(function (f) {
        $("#msg").html("Su transacción ha sido enviada. Espere unos segundos para la confirmación.").show();
        console.log(productId);
        f.liberarCantidadAlVendedor(productId, { from: web3.eth.accounts[0], gas: 440000 }).then(function (f) {
          $("#msg").html("Transacción realizada correctamente.").show();
          setTimeout(function () { location.reload() }, 3000);
          console.log(f);
        }).catch(function (e) {
          $("#error").show();
          $("#error").html("La transacción no se ha podido realizar, vuelva a intentarlo.");
          setTimeout(function () { location.reload() }, 2000);
          console.log(e);
        })
      });

    });

    $("#refund-funds").click(function () {
      if (typeof web3.eth.accounts[0] == "undefined") {
        $("#error").html("Debes iniciar sesión para poder añadir productos a la tienda.").show();
      }
      let productId = new URLSearchParams(window.location.search).get('id');
      NotarioVirtual.deployed().then(function (f) {
        $("#msg").html("Su transacción ha sido enviada. Espere unos segundos para la confirmación.").show();
        f.reembolsarCantidadAlComprador(productId, { from: web3.eth.accounts[0], gas: 440000 }).then(function (f) {
          console.log(f);
          $("#msg").html("Transacción realizada correctamente.").show();
          setTimeout(function () { location.reload() }, 3000);
        }).catch(function (e) {
          $("#error").show();
          $("#error").html("La transacción no se ha podido realizar, vuelva a intentarlo.");
          setTimeout(function () { location.reload() }, 2000);
          console.log(e);
        })
      });

      alert("¡Reembolsa los fondos!");

    });

    if ($("#product-details").length > 0) {
      //This is product details page
      let productId = new URLSearchParams(window.location.search).get('id');
      renderProductDetails(productId);
    }
  }
};

function displayPrice (amt) {
  return web3.fromWei(amt, 'ether') + " ETH";
}

function displayPrice2 (amt) {
  return web3.fromWei(amt, 'ether');
}

function renderProductDetails (productId) {
  $.ajax({
    url: offchainServer + "/producto",
    type: 'get',
    contentType: "application/json; charset=utf-8",
    data: { id: productId }
  }).done(function (data) {
    let content = "";
    ipfs.cat(data.ipfsDescHash).then(function (file) {
      content = file.toString();
      $("#product-desc").append("<div>" + content + "</div>");
    })
    if (data.condicion == 0) {
      var condicion = "Nuevo";
    } else {
      var condicion = "Usado";
    }
    $("#product-image").append("<img src='http://localhost:8080/ipfs/" + data.ipfsImagenHash + "'/>")
    $("#product-price").html(displayPrice(data.precioDeSalida));
    $("#product-estado").html(condicion);
    $("#product-buy-now-price").html(displayPrice(data.precioComprarAhora));
    $("#buy-now-price").val(data.precioComprarAhora);
    $("#product-name").html(data.nombre);
    $("#product-auction-end").html(displayEndHours(data.horaFinSubasta));
    $("#product-id").val(productId);
    $("#product-id2").val(data.blockchainId);
    $("#revealing, #bidding, #finalize-auction, #escrow-info, #buy-now, #boton-1, #boton-2").hide();
    let currentTime = getCurrentTimeInSeconds();
    if (data.estado == 1) {
      NotarioVirtual.deployed().then(function (i) {
        $("#escrow-info").show();
        i.informacionOfertaMasAlta.call(productId).then(function (f) {
          if (f[2].toLocaleString() == '0') {
            $("#product-status").html("La subasta ha terminado. No se revelaron ofertas.");
          } else {
            $("#product-status").html("<h5>La subasta ha terminado.</h5><br> Producto vendido a: <b>" + f[0] + "</b> por <b>" + displayPrice(f[2]) +
              "</b><br><br> El dinero está en el fideicomiso. Dos de los tres participantes (Comprador, Vendedor y Árbitro) tienen " +
              "que liberar los fondos al vendedor o devolver el dinero al comprador.<br><br>");
          }
        })
        i.infoFideicomiso.call(productId).then(function (f) {
          $("#buyer").html('Comprador: ' + f[0]);
          $("#seller").html('Vendedor: ' + f[1]);
          $("#arbiter").html('Arbitro: ' + f[2] + '<br>');
          if (f[3] == true) {
            $("#release-count").html("");
            $("#product-status").html("<b>La cantidad del depósito en garantía ha sido liberada</b>");
          } else {
            $("#release-count").html('<br>' + f[4] + " de 3 participantes han acordado liberar fondos.<br>");
            $("#refund-count").html(f[5] + " de 3 participantes han acordado reembolsar al comprador.<br>");
            $("#boton-1").show();
            $("#boton-2").show();
          }
        })
      })
    } else if (data.estado == 2) {
      $("#product-status").html("El producto no fue vendido.");
      $("#buy-now").show();
    } else if (currentTime < data.horaFinSubasta) {
      $("#bidding").show();
      $("#buy-now").show();
    } else if (currentTime - (600) < data.horaFinSubasta) {
      $("#revealing").show();
    } else if (data.estado == 0) {
      $("#finalize-auction").show();
    }
  })
}

function saveProduct (reader, decodedParams) {
  let imageId, descId;
  saveImageOnIpfs(reader).then(function (id) {
    imageId = id;
    saveTextBlobOnIpfs(decodedParams["product-description"]).then(function (id) {
      descId = id;
      saveProductToBlockchain(decodedParams, imageId, descId);
    })
  })
}

function saveProductToBlockchain (params, imageId, descId) {
  console.log(params);
  let auctionStartTime = Date.parse(params["product-auction-start"]) / 1000;
  let auctionEndTime = auctionStartTime + parseInt(params["product-auction-end"]) * 24 * 60 * 60

  NotarioVirtual.deployed().then(function (i) {
    $("#msg").html("Su producto ha sido enviado a la cadena de bloques. Espere unos segundos para la confirmación.").show();
    i.anadirProductoTienda(params["product-name"], params["product-category"], imageId, descId, auctionStartTime,
      auctionEndTime, web3.toWei(params["price"], 'ether'), web3.toWei(params["nowPrice"], 'ether'), parseInt(params["product-condition"]), { from: web3.eth.accounts[0], gas: 440000 }).then(function (f) {
        console.log(f);
        $("#msg").html("¡Su producto fue agregado exitosamente a la tienda!");
        setTimeout(function () { location.reload() }, 2000);
      }).catch(function (e) {
        $("#error").show();
        $("#error").html("No se pudo agregar el producto, vuelva a intentarlo.");
        setTimeout(function () { location.reload() }, 2000);
      });
  });
}

function saveTextBlobOnIpfs (blob) {
  return new Promise(function (resolve, reject) {
    const descBuffer = Buffer.from(blob, 'utf-8');
    ipfs.add(descBuffer)
      .then((response) => {
        console.log(response)
        resolve(response[0].hash);
      }).catch((err) => {
        console.error(err)
        reject(err);
      })
  })
}

function saveImageOnIpfs (reader) {
  return new Promise(function (resolve, reject) {
    const buffer = Buffer.from(reader.result);
    ipfs.add(buffer)
      .then((response) => {
        console.log(response)
        resolve(response[0].hash);
      }).catch((err) => {
        console.error(err)
        reject(err);
      })
  })
}

function getCurrentTimeInSeconds () {
  return Math.round(new Date() / 1000);
}

function displayEndHours (seconds) {
  let current_time = getCurrentTimeInSeconds()
  let remaining_seconds = seconds - current_time;

  if (remaining_seconds <= 0) {
    return "La subasta ha finalizado.";
  }

  let days = Math.trunc(remaining_seconds / (24 * 60 * 60));

  remaining_seconds -= days * 24 * 60 * 60
  let hours = Math.trunc(remaining_seconds / (60 * 60));

  remaining_seconds -= hours * 60 * 60

  let minutes = Math.trunc(remaining_seconds / 60);

  if (days > 0) {
    return days + " días, " + hours + " horas y " + minutes + " minutos";
  } else if (hours > 0) {
    return hours + " horas y " + minutes + " minutos ";
  } else if (minutes > 0) {
    return minutes + " minutos ";
  } else {
    return remaining_seconds + " segundos";
  }
}

function buildProduct (product) {
  if (product.condicion == 0) {
    var condicion = "<p>Condición: Nuevo</p>";
  } else {
    var condicion = "<p>Condición: Usado</p>";
  }
  let node = $("<div/>");
  node.addClass("col-6 col-md-4 product-home");
  node.append("<center><a href='producto.html?id=" + product.blockchainId + "'><img src='http://localhost:8080/ipfs/" + product.ipfsImagenHash + "' class='img-tam img-portfolio img-hover mb-3'/></a></center>");
  node.append("<div class='caption'><h4 class='pull-left'><a href='producto.html?id=" + product.blockchainId + "'>" + product.nombre + "</a></h4><p class='pull-right price-mob'>Precio Inicio: " + displayPrice(product.precioDeSalida) + "<br>Precio Comprar Ahora: " + displayPrice(product.precioComprarAhora) + "</p><div class='clearfix'></div><br><p>Categoria: " + product.categoria + "</p>" + condicion + "<p class='product-block-description hidden-sm-down'>Tiempo Restante: " + displayEndHours(product.horaFinSubasta) + "</p></div>");
  return node;
}

function renderProducts (div, filters) {
  $.ajax({
    url: offchainServer + "/productos",
    type: 'get',
    contentType: "application/json; charset=utf-8",
    data: filters
  }).done(function (data) {
    if (data.length == 0) {
      $("#" + div).html("<h3 class='text-center'>No se encontraron productos.</h3>");
    } else {
      $("#" + div).html('');
    }
    while (data.length > 0) {
      let chunks = data.splice(0, 22);
      let row = $("<div/>");
      row.addClass("row");
      chunks.forEach(function (value) {
        let node = buildProduct(value);
        row.append(node);
      })
      $("#" + div).append(row);
    }
  })
}

function renderStore () {
  renderProducts("product-list", {});
  renderProducts("product-reveal-list", { estado: "revelar" });
  renderProducts("product-finalize-list", { estado: "finalizado" });
  renderProducts("productos-vendidos", { estado: "vendido" });

  categorias.forEach(function (value) {
    $("#categorias").append("<li class='nav-item'><a href='#'  title='" + value + "'  class='level-1 trsn nav-link category-link'>" + value + "</a></li>");
  });
  cuenta();
}

function cuenta () {
  if (typeof web3.eth.accounts[0] == "undefined") {
    dinero = 0;
    document.getElementById("cuenta").innerHTML = "Inicia sesión en Metamask.";
    document.getElementById("cantidad-cuenta").innerHTML = dinero + " ETH";
  } else {
    web3.eth.getBalance(web3.eth.accounts[0], function (e, bal) {
      dinero = web3.fromWei(bal, "ether").toNumber();
    });
    document.getElementById("cuenta").innerHTML = "Bienvenido " + web3.eth.accounts[0];
    document.getElementById("cantidad-cuenta").innerHTML = dinero + " ETH";
  }
  setTimeout(cuenta, 1000);
}

window.addEventListener('load', function () {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    $('#metamask-ausente').show();
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }
  App.start();
});