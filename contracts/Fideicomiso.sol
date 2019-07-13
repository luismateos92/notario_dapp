pragma solidity >=0.4.24;

contract Fideicomiso {
 uint public productoId;
 address payable public comprador;
 address payable public vendedor;
 address payable public arbitro;
 uint public cantidad;
 uint public cantidadArbitro;
 bool public fondosDesembolsados;
 mapping (address => bool) liberarImporte;
 uint public liberarCount;
 mapping (address => bool) reembolsoCantidad;
 uint public reembolsoCount;

 event CrearFideicomiso(uint _productoId, address payable _comprador, address payable _vendedor, address payable _arbitro);
 event DesbloquearCantidad(uint _productoId, string _operacion, address _operador);
 event DesembolsarCantidad(uint _productoId, uint _cantidad, address _beneficiario);

 constructor (
     uint _productoId,
     address payable _comprador,
     address payable _vendedor,
     address payable _arbitro,
     uint _cantidadArbitro
     ) payable public {
  productoId = _productoId;
  comprador = _comprador;
  vendedor = _vendedor;
  arbitro = _arbitro;
  cantidad = msg.value-_cantidadArbitro;
  cantidadArbitro = _cantidadArbitro;
  fondosDesembolsados = false;
  emit CrearFideicomiso(_productoId, _comprador, _vendedor, _arbitro);
 }

 function infoFideicomiso() public view returns (address payable, address payable, address payable, bool, uint, uint) {
  return (comprador, vendedor, arbitro, fondosDesembolsados, liberarCount, reembolsoCount);
 }

 function liberarCantidadAlVendedor(address caller) public {
  require(!fondosDesembolsados, "Se requieren fondos");
  if ((caller == comprador || caller == vendedor || caller == arbitro) && liberarImporte[caller] != true) {
   liberarImporte[caller] = true;
   liberarCount += 1;
   emit DesbloquearCantidad(productoId, "Liberar", caller);
  }

  if (liberarCount == 2) {
   vendedor.transfer((cantidad*99)/100);
   arbitro.transfer((cantidad/100)+cantidadArbitro);
   fondosDesembolsados = true;
   emit DesembolsarCantidad(productoId, cantidad, vendedor);
  }
 }

 function reembolsarCantidadAlComprador(address caller) public {
  require(!fondosDesembolsados, "Se requieren fondos");
  if ((caller == comprador || caller == vendedor || caller == arbitro) && liberarImporte[caller] != true) {
   reembolsoCantidad[caller] = true;
   reembolsoCount += 1;
   emit DesbloquearCantidad(productoId, "Reembolso", caller);
  }

  if (reembolsoCount == 2) {
   comprador.transfer(cantidad);
   arbitro.transfer(cantidadArbitro);
   fondosDesembolsados = true;
   emit DesembolsarCantidad(productoId, cantidad, comprador);
  }
 }
}