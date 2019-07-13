pragma solidity >=0.4.24;

import "contracts/Fideicomiso.sol";

contract NotarioVirtual {
	enum EstadoProducto { EnVenta, Vendido, SinVender }
	enum CondicionProducto { Nuevo, Usado }

	uint public productoIndex;

	mapping (address => mapping(uint => Producto)) almacen;
	mapping (uint => address payable) productoIdEnTienda;
	mapping (uint => address) productoFideicomiso;

	address payable public owner;

	struct Oferta {
		address postor;
		uint productoId;
		uint valor;
		bool revelado;
	}

	struct Producto {
		uint id;
		string nombre;
		string categoria;
		string imagenLink;
		string descLink;
		uint horaInicioSubasta;
		uint horaFinSubasta;
		uint precioDeSalida;
		uint precioComprarAhora;
		address payable mejorPostor;
		uint mejorApuesta;
		uint segundaMejorOferta;
		uint ofertasTotales;
		EstadoProducto estado;
		CondicionProducto condicion;
		bool comprado;
		mapping (address => mapping (bytes32 => Oferta)) ofertas;
	}

	constructor() public {
		productoIndex = 0;
		owner = msg.sender;
	}

	event NuevoProducto(
		uint _productoId,
		string _nombre,
		string _categoria,
		string _imagenLink,
		string _descLink,
		uint _horaInicioSubasta,
		uint _horaFinSubasta,
		uint _precioDeSalida,
		uint _precioComprarAhora,
		uint _condicion
	);
	event RevelarOferta(
		uint _productoId,
		bytes32 _ofertaSellada,
		uint _cantidad,
		address _postor
	);
	event FinalizarSubasta(
		uint _productoId,
		uint _cantidadGanadora,
		address _postor,
		EstadoProducto _estado
	);

	function anadirProductoTienda(
		string memory _nombre,
		string memory _categoria,
		string memory _imagenLink,
		string memory _descLink,
		uint _horaInicioSubasta,
		uint _horaFinSubasta,
		uint _precioDeSalida,
		uint _precioComprarAhora,
		uint _condicion
	) public {
		require (_horaInicioSubasta < _horaFinSubasta, "La hora de inicio tiene que ser anterior a la de finalización");
		productoIndex += 1;
		Producto memory producto = Producto(
			productoIndex,
			_nombre,
			_categoria,
			_imagenLink,
			_descLink,
			_horaInicioSubasta,
			_horaFinSubasta,
			_precioDeSalida,
			_precioComprarAhora,
			address(0),
			0,
			0,
			0,
			EstadoProducto.EnVenta,
			CondicionProducto(_condicion),
			false
		);
		almacen[msg.sender][productoIndex] = producto;
		productoIdEnTienda[productoIndex] = msg.sender;
		emit NuevoProducto(
			productoIndex,
			_nombre,
			_categoria,
			_imagenLink,
			_descLink,
			_horaInicioSubasta,
			_horaFinSubasta,
			_precioDeSalida,
			_precioComprarAhora,
			_condicion
		);
	}

	function obtenerProducto(uint _productoId) public view returns (
		uint,
		string memory,
		string memory,
		string memory,
		string memory,
		uint,
		uint,
		uint,
		uint,
		EstadoProducto) {
		Producto memory producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		return (producto.id, producto.nombre, producto.categoria, producto.imagenLink, producto.descLink, producto.horaInicioSubasta,
			producto.horaFinSubasta, producto.precioDeSalida, producto.precioComprarAhora, producto.estado);
	}

	function pujar(uint _productoId, bytes32 _puja) public payable returns (bool) {
		Producto storage producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		require (now >= producto.horaInicioSubasta, "La hora de inicio de la puja tiene que ser anterior a la hora actual.");
		require (now <= producto.horaFinSubasta, "La hora de fin de la puja tiene que ser posterior a la hora actual.");
		require (productoIdEnTienda[_productoId] != msg.sender, "No puedes pujar por tu mismo producto.");
		require (msg.value > producto.precioDeSalida, "El valor de la puja tiene que ser superior al precio de salida");
		require (msg.value < producto.precioComprarAhora, "El valor de la puja no puede super el precio de comprar ahora.");
		require (producto.comprado != true, "El producto ya ha sido comprado");
		require (producto.ofertas[msg.sender][_puja].postor == address(0), "Ya has pujado anteriormente, no puedes volver a pujar.");
		producto.ofertasTotales += 1;
		producto.ofertas[msg.sender][_puja] = Oferta(msg.sender, _productoId, msg.value, false);
		return true;
	}

	function revelarOferta(uint _productoId, string memory _cantidad, string memory _secreto) public {
		Producto storage producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		require (now >= producto.horaInicioSubasta, "La hora de inicio de la puja tiene que ser anterior a la hora actual.");
		bytes32 ofertaSellada = keccak256(abi.encodePacked(_cantidad, _secreto));
		Oferta memory infoPuja = producto.ofertas[msg.sender][ofertaSellada];
		require (infoPuja.postor > address(0), "Ya hay postores en la puja");
		require (infoPuja.revelado == false, "La puja ya ha sido revelada");
		uint reembolso;
		uint cantidad = stringToUint(_cantidad);
		if(infoPuja.valor < cantidad) {
			// No enviaron suficiente cantidad, perdieron
			reembolso = infoPuja.valor;
		} else {
			// Si es el primero en revelar que se ha fijado como mejor postor
			if (address(producto.mejorPostor) == address(0)) {
				producto.mejorPostor = msg.sender;
				producto.mejorApuesta = cantidad;
				producto.segundaMejorOferta = producto.precioDeSalida;
				reembolso = infoPuja.valor - cantidad;
			} else {
				if (cantidad > producto.mejorApuesta) {
					// Devolver el importe restante al perdedor
					producto.mejorPostor.transfer(producto.mejorApuesta);
					producto.segundaMejorOferta = producto.mejorApuesta;
					producto.mejorPostor = msg.sender;
					producto.mejorApuesta = cantidad;
					reembolso = infoPuja.valor - cantidad;
				} else if (cantidad > producto.segundaMejorOferta) {
					producto.segundaMejorOferta = cantidad;
					reembolso = cantidad;
				} else {
					reembolso = cantidad;
				}
			}
			producto.ofertas[msg.sender][ofertaSellada].revelado = true;
			emit RevelarOferta(_productoId, ofertaSellada, cantidad, msg.sender);
		}
		if (reembolso > 0) {
			msg.sender.transfer(reembolso);
		}
	}

	function informacionOfertaMasAlta(uint _productoId) public view returns (address, uint, uint) {
		Producto memory producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		return (producto.mejorPostor, producto.mejorApuesta, producto.segundaMejorOferta);
	}

	function ofertasTotales(uint _productoId) public view returns (uint) {
		Producto memory producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		return producto.ofertasTotales;
	}

	function stringToUint(string memory s) private pure returns (uint) {
		bytes memory b = bytes(s);
		uint result = 0;
		for (uint i = 0; i < b.length; i++) {
			if (b[i] >= 48 && b[i] <= 57) {
				result = result * 10 + (uint(b[i]) - 48);
			}
		}
		return result;
	}

	function finalizarSubasta(uint _productoId) public payable {
		Producto memory producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		// 48 horas para revelar la oferta
		require(now > producto.horaFinSubasta, "La hora de fin de la puja tiene que ser anterior a la hora actual.");
		require(producto.estado == EstadoProducto.EnVenta, "El estado del producto tiene que ser en venta.");
		require(producto.mejorPostor != msg.sender, "El mejor postor tiene que ser distinto al usuario que finaliza la puja.");
		require(productoIdEnTienda[_productoId] != msg.sender, "El usuario tiene que ser distinto al vendedor.");
		if (producto.ofertasTotales == 0) {
			producto.estado = EstadoProducto.SinVender;
			msg.sender.transfer(msg.value);
			emit FinalizarSubasta(_productoId, producto.segundaMejorOferta, producto.mejorPostor, producto.estado);
		} else {
			Fideicomiso fideicomiso;
			if (producto.comprado == false) {
				// Quien finaliza la subasta es el árbitro
				fideicomiso = (new Fideicomiso).value(producto.segundaMejorOferta+5000000000000000000)(_productoId, producto.mejorPostor, productoIdEnTienda[_productoId], msg.sender, 5000000000000000000);
				productoFideicomiso[_productoId] = address(fideicomiso);
				producto.estado = EstadoProducto.Vendido;
				// El postor sólo paga el importe equivalente al segundo postor más alto
				// Devolver la diferencia
				uint refund = producto.mejorApuesta - producto.segundaMejorOferta;
				producto.mejorPostor.transfer(refund);
				emit FinalizarSubasta(_productoId, producto.segundaMejorOferta, producto.mejorPostor, producto.estado);
			} else {
				fideicomiso = (new Fideicomiso).value(producto.precioComprarAhora+5000000000000000000)(_productoId, producto.mejorPostor, productoIdEnTienda[_productoId], msg.sender, 5000000000000000000);
				productoFideicomiso[_productoId] = address(fideicomiso);
				producto.estado = EstadoProducto.Vendido;
				producto.segundaMejorOferta = producto.precioComprarAhora;
				emit FinalizarSubasta(_productoId, producto.precioComprarAhora, producto.mejorPostor, producto.estado);
			}
		}
		almacen[productoIdEnTienda[_productoId]][_productoId] = producto;
	}

	function comprarProducto(uint _productoId) public payable {
		Producto memory producto = almacen[productoIdEnTienda[_productoId]][_productoId];
		require(now < producto.horaFinSubasta, "La hora de finalización de la puja tiene que ser posterior a la fecha actual.");
		require(producto.estado == EstadoProducto.EnVenta, "El estado del producto tiene que ser en venta.");
		require(msg.value >= producto.precioComprarAhora, "El valor de la compra tiene que ser mayor o igual al precio de comprar ahora.");
		require(productoIdEnTienda[_productoId] != msg.sender, "EL usuario tiene que ser distinto al vendedor.");

		if (producto.ofertasTotales == 0) {
			Fideicomiso fideicomiso = (new Fideicomiso).value(msg.value)(_productoId, msg.sender, productoIdEnTienda[_productoId], owner, 0);
			productoFideicomiso[_productoId] = address(fideicomiso);
			producto.estado = EstadoProducto.Vendido;
			producto.mejorPostor = msg.sender;
			producto.mejorApuesta = msg.value;
			producto.horaFinSubasta = now;
			producto.comprado = true;
		} else {
			producto.mejorPostor = msg.sender;
			producto.mejorApuesta = msg.value;
			producto.horaFinSubasta = now;
			producto.comprado = true;
		}
		almacen[productoIdEnTienda[_productoId]][_productoId] = producto;
		emit FinalizarSubasta(_productoId, msg.value, msg.sender, producto.estado);
	}

	function fideicomisoAddressParaProducto(uint _productoId) public view returns (address) {
		return productoFideicomiso[_productoId];
	}

	function infoFideicomiso(uint _productoId) public view returns (address, address, address, bool, uint, uint) {
		return Fideicomiso(productoFideicomiso[_productoId]).infoFideicomiso();
	}

	function liberarCantidadAlVendedor(uint _productoId) public {
		Fideicomiso(productoFideicomiso[_productoId]).liberarCantidadAlVendedor(msg.sender);
	}

	function reembolsarCantidadAlComprador(uint _productoId) public {
		Fideicomiso(productoFideicomiso[_productoId]).reembolsarCantidadAlComprador(msg.sender);
	}
}