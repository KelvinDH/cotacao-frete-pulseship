
import React, { useState, useEffect } from 'react';
import { FileText, Plus, MapPin, Weight, DollarSign, Calendar, Truck, Route, Upload, Image as ImageIcon, Eye, X, CheckCircle, Users, Loader2, Map, ChevronDown, Receipt, Minus, AlertTriangle } from "lucide-react";
import { FreightMap, TruckType, Carrier, User, UploadFile } from "@/components/ApiDatabase";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import RouteMapComponent from '../components/RouteMapComponent';
import CityCombobox from '../components/CityCombobox';

// IMPORTANDO DADOS LOCAIS
import { states as statesData } from '../components/data/states';
import { cities as allCitiesData } from '../components/data/cities';

// Opções pré-definidas para o campo Gerente
const managerOptions = ["TIAGO LOPES TOLENTINO", "CLAUDIO FEUSER", "DIEGO JOSÉ MANIAS MARSÃO", "VENDA DIRETA", "VerdeLog"];

export default function QuotePage() {
  const [formData, setFormData] = useState({
    currentUser: '',
    mapNumber: '',
    origin: 'Pederneiras/SP', // Valor fixo pré-definido
    destinationState: '', // Will be updated by selectRoute
    destinationCity: '', // Will be updated by selectRoute
    totalKm: '',
    weight: '',
    mapValue: '',
    truckType: '',
    selectedCarriers: [],
    loadingMode: '',
    loadingDate: null,
    routeInfo: '',
    mapImage: '',
    // ✅ NOVOS ESTADOS PARA COMBUSTÍVEL
    fuelPrice: '',
    fuelEfficiency: ''
  });

  const [truckTypes, setTruckTypes] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Novos estados para Gerente/Valor e para o tipo de usuário
  const [managerFields, setManagerFields] = useState([{ gerente: '', valor: '' }]);
  const [currentUser, setCurrentUser] = useState(null);

  // Novos estados para seleção de destino e cálculo de rota
  const [states, setStates] = useState([]);
  // `cities` state is not directly used globally anymore, filtering is done per combobox instance

  // NOVOS ESTADOS para a integração com OpenRouteService
  const [routeData, setRouteData] = useState(null); // This will store the *selected* route data for submission
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(''); // Initialize with empty string

  // ✅ NOVO ESTADO para o custo do pedágio
  const [tollCost, setTollCost] = useState(null);

  // ✅ NOVO ESTADO: Para armazenar informações detalhadas dos pedágios
  const [tollDetails, setTollDetails] = useState(null);

  // ✅ REMOVIDO: O estado showRouteMap foi removido pois não é mais necessário.

  // ✅ NOVO: Estados para controle de eixos
  const [axleCount, setAxleCount] = useState(2);

  // ✅ NOVO: Estados para múltiplos destinos e comparação
  const [destinations, setDestinations] = useState([{ state: '', city: '' }]);
  const [routeComparison, setRouteComparison] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [truckData, carrierData] = await Promise.all([
          TruckType.list(),
          Carrier.list()
        ]);
        setTruckTypes(truckData);
        setCarriers(carrierData.filter(c => c.active));
        // CARREGANDO ESTADOS DO ARQUIVO LOCAL
        setStates(statesData.sort((a, b) => a.Nome.localeCompare(b.Nome)));
      } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        alert("Erro ao carregar dados iniciais.");
      }
    };
    loadInitialData();

    const fetchUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Não foi possível buscar o usuário:", error);
        setCurrentUser({ userType: 'admin' }); // Fallback for local development
      }
    };
    fetchUser();
  }, []);

  const handleInputChange = (field, value) => {
    // Impede alteração do campo origin
    if (field === 'origin') return;

    if (field === 'truckType') {
        setFormData(prev => ({
            ...prev,
            truckType: value,
        }));
    } else if (field === 'loadingMode') {
      setFormData(prev => ({
        ...prev,
        loadingMode: value,
        selectedCarriers: [], // Limpa as transportadoras selecionadas
        truckType: '' // Limpa o tipo de caminhão selecionado
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // ✅ NOVA FUNÇÃO: Gerenciar múltiplos destinos
  const handleDestinationChange = (index, field, value) => {
    const newDestinations = [...destinations];
    newDestinations[index][field] = value;

    if (field === 'state') {
      newDestinations[index].city = ''; // Reseta cidade quando estado muda
    }

    setDestinations(newDestinations);
    // Limpa dados anteriores ao alterar qualquer destino
    setRouteData(null); // Clear chosen route data
    setRouteComparison(null); // Clear comparison results
    setShowComparison(false); // Hide comparison section
    setRouteError(''); // Clear route error
    setTollCost(null); // Clear toll cost
    setTollDetails(null); // Clear toll details
    handleInputChange('totalKm', ''); // Clear totalKm
  };

  const addDestination = () => {
    setDestinations([...destinations, { state: '', city: '' }]);
  };

  const removeDestination = (index) => {
    if (destinations.length > 1) { // Ensure at least one destination remains
      const newDestinations = destinations.filter((_, i) => i !== index);
      setDestinations(newDestinations);
      // Also clear route related data if destinations change
      setRouteData(null);
      setRouteComparison(null);
      setShowComparison(false);
      setRouteError('');
      setTollCost(null);
      setTollDetails(null);
      handleInputChange('totalKm', '');
    }
  };

  // ✅ FUNÇÃO calculateRoute CORRIGIDA - restaurando setRouteData
  const calculateRoute = async () => {
    const validDestinations = destinations.filter(d => d.state && d.city);
    
    if (validDestinations.length === 0) {
      alert("Por favor, selecione pelo menos um destino para calcular a rota.");
      return;
    }

    setRouteLoading(true);
    setRouteError('');
    setRouteComparison(null);
    setShowComparison(false);
    setRouteData(null);
    setTollCost(null);
    setTollDetails(null);
    handleInputChange('totalKm', '');

    try {
      const destinationsPayload = validDestinations.map(d => {
        const stateObj = states.find(s => s.ID == d.state);
        if (!stateObj) {
            throw new Error(`Estado inválido selecionado para o destino: ${d.state}`);
        }
        return { city: d.city, state: stateObj.Sigla };
      });

      const apiUrl = `http://${window.location.hostname}:3001/api/calculate-route`;
      const requestBody = {
        destinations: destinationsPayload,
        axles: axleCount,
        weight: formData.weight ? parseFloat(formData.weight) : 15000,
        // ✅ ENVIANDO DADOS DE COMBUSTÍVEL (se existirem)
        fuelPrice: formData.fuelPrice ? parseFloat(formData.fuelPrice) : null,
        fuelEfficiency: formData.fuelEfficiency ? parseFloat(formData.fuelEfficiency) : null
      };

      console.log('🚀 Enviando para API (cálculo):', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Dados do cálculo recebidos:", data);
        
        // ✅ NOVO: Log mais detalhado dos dados das rotas
        if (data.routes) {
          console.log("🔍 Detalhes da rota econômica:", data.routes.economic);
          console.log("🔍 Detalhes da rota mais curta:", data.routes.shortest);
          
          if (data.routes.economic) {
            console.log("📊 Rota econômica - Distância:", data.routes.economic.distance);
            console.log("📊 Rota econômica - Duração:", data.routes.economic.duration);
            console.log("📊 Rota econômica - Pedágios:", data.routes.economic.tollData);
            console.log("📊 Rota econômica - Geometria:", data.routes.economic.geometry?.length || 0, "pontos");
          }
        }
        
        if (data.fractionalRoutes) {
          console.log("🔍 Rotas fracionadas:", data.fractionalRoutes);
        }
        
        setRouteComparison(data);
        setShowComparison(true);
        setRouteError('');
        
        // ✅ RESTAURADO: Preenche automaticamente com a rota econômica E salva os dados completos
        if (data.routes.economic) {
          const selectedRoute = data.routes.economic;
          
          // Set formData for submission
          handleInputChange('totalKm', Math.round(selectedRoute.distance).toString());
          
          // Set the formData.destinationState and formData.destinationCity to the *last* destination for backend compatibility
          const lastDest = destinations[destinations.length - 1];
          setFormData(prev => ({
              ...prev,
              destinationState: lastDest.state,
              destinationCity: lastDest.city
          }));

          // Populate toll and route details for display and submission
          setTollCost(selectedRoute.tollData.totalCost);
          setTollDetails({
            totalCost: selectedRoute.tollData.totalCost,
            pointCount: selectedRoute.tollData.tolls.length,
            points: selectedRoute.tollData.tolls,
            currency: selectedRoute.tollData.currency || 'BRL',
            vehicleInfo: selectedRoute.tollData.vehicleInfo || { axles: axleCount }
          });

          // ✅ CRUCIAL: Store the complete route data for other pages (Negotiation/Contracted)
          setRouteData({
            origin: data.origin,
            destination: data.destination,
            waypoints: data.waypoints || [],
            routes: {
              economic: selectedRoute,
              shortest: data.routes.shortest
            }
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Erro ao calcular rota');
      }

    } catch (error) {
      console.error("Erro ao calcular rotas:", error);
      setRouteError('Não foi possível calcular a rota. Verifique os destinos e tente novamente.');
      setRouteComparison(null);
      setShowComparison(false);
    } finally {
      setRouteLoading(false);
    }
  };

  // ✅ NOVA FUNÇÃO: Para controlar o número de eixos
  const handleAxleChange = (amount) => {
    setAxleCount(prev => {
      const newCount = prev + amount;
      if (newCount < 2) return 2;
      if (newCount > 10) return 10;
      return newCount;
    });
    // Clear route comparison and selected route data when axles change
    setRouteData(null);
    setRouteComparison(null);
    setShowComparison(false);
    setRouteError('');
    setTollCost(null);
    setTollDetails(null);
    handleInputChange('totalKm', '');
  };

  const handleMapNumberChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '');
    const truncatedDigits = digitsOnly.slice(0, 8);

    let maskedValue = truncatedDigits;
    if (truncatedDigits.length > 2) {
      maskedValue = `${truncatedDigits.slice(0, 2)}/${truncatedDigits.slice(2)}`;
    }

    handleInputChange('mapNumber', maskedValue);
  };

  const handleCarrierToggle = (carrierName, checked) => {
    setFormData(prev => ({
      ...prev,
      selectedCarriers: checked
        ? [...prev.selectedCarriers, carrierName]
        : prev.selectedCarriers.filter(name => name !== carrierName)
    }));
  };

  // Função para calcular o total dos valores dos gerentes
  const calculateManagersTotal = () => {
    return managerFields.reduce((total, field) => {
      const valor = parseFloat(field.valor) || 0;
      return total + valor;
    }, 0);
  };

  // Função para verificar se pode adicionar mais gerentes
  const canAddMoreManagers = () => {
    const mapValue = parseFloat(formData.mapValue) || 0;
    const managersTotal = calculateManagersTotal();
    return mapValue > 0 && managersTotal < mapValue;
  };

  // Função para obter o valor restante disponível
  const getRemainingValue = () => {
    const mapValue = parseFloat(formData.mapValue) || 0;
    const managersTotal = calculateManagersTotal();
    return Math.max(0, mapValue - managersTotal);
  };

  // Funções para gerenciar os campos de Gerente/Valor
  const handleManagerChange = (index, field, value) => {
    const updatedFields = [...managerFields];

    // Validação para o campo valor
    if (field === 'valor') {
      // Limita a 9 dígitos
      if (value.length > 9) return;

      const numericValue = parseFloat(value) || 0;
      const mapValue = parseFloat(formData.mapValue) || 0;

      // Validação 1: Valor individual não pode ser maior que o valor do mapa
      if (mapValue > 0 && numericValue > mapValue) {
        alert(`O valor do gerente (${numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) não pode ser maior que o valor do mapa (R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
        return;
      }

      // Calcular o total atual sem este campo para verificar se a soma ultrapassa o limite
      const currentTotalExcludingThisField = managerFields.reduce((total, f, i) => {
        if (i === index) return total; // Pula o campo atual
        return total + (parseFloat(f.valor) || 0);
      }, 0);

      // Validação 2: A soma dos valores dos gerentes não pode ultrapassar o valor do mapa
      if (mapValue > 0 && (currentTotalExcludingThisField + numericValue) > mapValue) {
        const remaining = Math.max(0, mapValue - currentTotalExcludingThisField);
        alert(`O valor excede o limite do mapa. Valor máximo disponível para este campo: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        return;
      }
    }

    updatedFields[index][field] = value;
    setManagerFields(updatedFields);
  };

  const addManagerField = () => {
    if (!formData.mapValue || parseFloat(formData.mapValue) === 0) {
      alert("Por favor, preencha o 'Valor do Mapa' antes de adicionar gerentes.");
      return;
    }

    if (!canAddMoreManagers()) {
      const mapValue = parseFloat(formData.mapValue) || 0;
      const managersTotal = calculateManagersTotal();

      if (managersTotal >= mapValue) {
        alert(`Não é possível adicionar mais gerentes. O valor total dos gerentes (R$ ${managersTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) já atingiu o valor do mapa (R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      } else {
        alert(`Valor do mapa insuficiente para adicionar mais gerentes. Complete o valor dos gerentes existentes primeiro.`);
      }
      return;
    }
    setManagerFields([...managerFields, { gerente: '', valor: '' }]);
  };

  const removeManagerField = (index) => {
    const updatedFields = [...managerFields];
    updatedFields.splice(index, 1);
    setManagerFields(updatedFields);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        mapImage: file_url
      }));
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Erro ao fazer upload da imagem. Verifique se a API está rodando.");
    } finally {
      setUploadingImage(false);
    }
  };

  // NOVA FUNÇÃO: Para mapear modalidades fracionadas às suas principais
  const getCompatibleModality = (selectedModality) => {
    switch (selectedModality) {
      case 'bag_fracionado':
        return 'bag';
      case 'paletizados_fracionado':
        return 'paletizados';
      default:
        return selectedModality;
    }
  };

  // Função para filtrar tipos de caminhão baseado na modalidade selecionada
  const getFilteredTruckTypes = () => {
    if (!formData.loadingMode) {
      return [];
    }
    // ATUALIZADO: Usa a modalidade compatível para filtrar
    const compatibleModality = getCompatibleModality(formData.loadingMode);
    return truckTypes.filter(truck => truck.modality === compatibleModality);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação atualizada para os novos campos de destino
    const finalDestination = destinations[destinations.length - 1];
    if (!formData.mapNumber || !formData.origin || !finalDestination.state || !finalDestination.city || !formData.totalKm || !formData.weight || !formData.mapValue || !formData.truckType || formData.selectedCarriers.length === 0 || !formData.loadingMode || !formData.loadingDate) {
      alert("Por favor, preencha todos os campos obrigatórios e selecione pelo menos uma transportadora");
      return;
    }

    // ✅ MANTIDO: Ensure a route has been selected/calculated if totalKm is present
    if (formData.totalKm && !routeData) {
        alert("Por favor, calcule a rota antes de enviar.");
        return;
    }

    // Construir string de destino completa (Ex: "Cidade/UF") using the LAST destination in the array
    const selectedStateObj = states.find(s => s.ID == finalDestination.state);
    const fullDestination = selectedStateObj ? `${finalDestination.city}/${selectedStateObj.Sigla}` : `${finalDestination.city}/${finalDestination.state}`;

    let carriersToSend = [];
    let duplicateCarriers = [];

    try {
      const allMaps = await FreightMap.list();

      duplicateCarriers = formData.selectedCarriers.filter(carrierName =>
        allMaps.some(map => map.mapNumber === formData.mapNumber && map.selectedCarrier === carrierName)
      );

      carriersToSend = formData.selectedCarriers.filter(carrierName =>
        !allMaps.some(map => map.mapNumber === formData.mapNumber && map.selectedCarrier === carrierName)
      );

      if (duplicateCarriers.length > 0) {
        const message = `As seguintes transportadoras já receberam o mapa ${formData.mapNumber}: ${duplicateCarriers.join(', ')}.\n\nA cotação será enviada apenas para as demais transportadoras selecionadas.`;
        if (!confirm(message + "\n\nDeseja continuar?")) {
          return;
        }
      }

      if (carriersToSend.length === 0) {
        alert(`Todas as transportadoras selecionadas já receberam o mapa ${formData.mapNumber}. Selecione outras transportadoras ou use um número de mapa diferente.`);
        return;
      }
    } catch (error) {
      console.error("Erro ao verificar mapa existente:", error);
      carriersToSend = [...formData.selectedCarriers];
      duplicateCarriers = [];
    }

    const mapValue = parseFloat(formData.mapValue) || 0;
    const managersTotal = calculateManagersTotal();

    if (currentUser && currentUser.userType !== 'carrier') {
      if (managersTotal > mapValue) {
        alert(`Erro: O valor total dos gerentes (R$ ${managersTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede o valor do mapa (R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Por favor, ajuste os valores.`);
        return;
      }
      if (managersTotal < mapValue && managerFields.some(f => f.gerente || f.valor)) {
        alert(`Atenção: O valor total dos gerentes (R$ ${managersTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor que o valor do mapa (R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Considere ajustar ou adicionar mais gerentes.`);
      }
    }

    setLoading(true);
    try {
      const getBrazilIsoNow = () => {
        const now = new Date();
        const offset = -3; // UTC-3 for Brazil (e.g., São Paulo)
        const brazilTime = new Date(now.setHours(now.getHours() + offset - now.getTimezoneOffset() / 60));
        return brazilTime.toISOString();
      };

      const baseFreightData = {
        mapNumber: formData.mapNumber,
        mapImage: formData.mapImage,
        origin: formData.origin,
        destination: fullDestination, // Usa o destino completo construído
        totalKm: parseInt(formData.totalKm),
        weight: parseFloat(formData.weight),
        mapValue: parseFloat(formData.mapValue),
        truckType: formData.truckType,
        loadingMode: formData.loadingMode,
        loadingDate: formData.loadingDate ? format(formData.loadingDate, 'yyyy-MM-dd') : '',
        routeInfo: formData.routeInfo,
        managers: managerFields
          .filter(f => f.gerente && f.valor && parseFloat(f.valor) > 0)
          .map(f => ({ ...f, valor: parseFloat(f.valor) })),
        carrierProposals: {},
        status: 'negotiating',
        invoiceUrls: [],
        routeData: routeData, // ✅ This ensures the complete route comparison data is saved
        created_date: getBrazilIsoNow(),
        updated_date: getBrazilIsoNow(),
        // Add new fuel fields to the data being sent
        fuelPrice: formData.fuelPrice ? parseFloat(formData.fuelPrice) : null,
        fuelEfficiency: formData.fuelEfficiency ? parseFloat(formData.fuelEfficiency) : null,
        created_by: currentUser?.fullName || 'system'
      };

      const freightPromises = carriersToSend.map(carrierName => {
        return FreightMap.create({
          ...baseFreightData,
          selectedCarrier: carrierName
        });
      });

      await Promise.all(freightPromises);
      
      let successMessage = `Cotação criada com sucesso para ${carriersToSend.length} transportadora(s)!`;
      if (duplicateCarriers.length > 0) {
        successMessage += `\n\nNota: ${duplicateCarriers.length} transportadora(s) foram puladas por já terem recebido este mapa.`;
      }
      successMessage += '\n\nEmails de notificação foram enviados.';

      alert(successMessage);

      setFormData({
        mapNumber: '',
        origin: 'Pederneiras/SP',
        destinationState: '',
        destinationCity: '',
        totalKm: '',
        weight: '',
        mapValue: '',
        truckType: '',
        selectedCarriers: [],
        loadingMode: '',
        loadingDate: null,
        routeInfo: '',
        mapImage: '',
        fuelPrice: '', // Clear this
        fuelEfficiency: '' // Clear this
      });
      setManagerFields([{ gerente: '', valor: '' }]);
      setRouteError('');
      setRouteData(null);
      setTollCost(null);
      setTollDetails(null);
      setAxleCount(2);
      setDestinations([{ state: '', city: '' }]);
      setRouteComparison(null);
      setShowComparison(false);
    } catch (error) {
      console.error("Error creating freight map:", error);
      alert("Erro ao criar cotação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      mapImage: ''
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className=" mx-full">

        <Card className="shadow-xl border-0 mt-4">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
            <CardTitle className="text-xl">Informações da Cotação</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                  Identificação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número do Mapa *
                    </label>
                    <Input
                      type="text"
                      value={formData.mapNumber}
                      onChange={(e) => handleMapNumberChange(e.target.value)}
                      placeholder="00/000000"
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                      maxLength={9}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modalidade de Carregamento *
                    </label>
                    <Select value={formData.loadingMode} onValueChange={(value) => handleInputChange('loadingMode', value)}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Selecione a modalidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paletizados">📦 Paletizados</SelectItem>
                        <SelectItem value="bag">🎒 BAG</SelectItem>
                        <SelectItem value="granel">🌾 Granel</SelectItem>
                        <SelectItem value="bag_fracionado">🎒 BAG Fracionado</SelectItem>
                        <SelectItem value="paletizados_fracionado">📦 Paletizados Fracionado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-6 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 mr-2 text-indigo-600" />
                  Mapa da Rota
                </h3>

                <div className="flex justify-center">
                  {!formData.mapImage ? (
                    <div className="w-full max-w-2xl border-2 border-dashed border-indigo-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors bg-white">
                      <div className="space-y-6">
                        <div className="mx-auto w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                          <Upload className="w-10 h-10 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-lg text-gray-700 font-medium">Anexar Imagem do Mapa</p>
                          <p className="text-sm text-gray-500 mt-2">PNG, JPG até 10MB</p>
                        </div>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingImage}
                            className="border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-8 py-3"
                          >
                            {uploadingImage ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                Enviando...
                              </div>
                            ) : (
                              <>
                                <Upload className="w-5 h-5 mr-2" />
                                Escolher Arquivo
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-2xl space-y-4">
                      <div className="relative group bg-white rounded-lg p-4 shadow-sm">
                        <img
                          src={formData.mapImage}
                          alt="Mapa da Rota"
                          className="w-full h-[500px] object-contain rounded-lg"
                        />
                        <div className="absolute inset-4 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setShowImagePreview(true)}
                              className="bg-white text-gray-800 hover:bg-gray-100"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={removeImage}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center text-green-700 mb-2">
                          <CheckCircle className="w-6 h-6 mr-2" />
                          <span className="font-medium text-lg">Imagem carregada com sucesso!</span>
                        </div>
                        <p className="text-sm text-green-600">
                          Clique na imagem para visualizar em tamanho maior
                        </p>
                      </div>

                      <div className="relative flex justify-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-300 px-8"
                          disabled={uploadingImage}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Trocar Imagem
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ SEÇÃO ATUALIZADA: Informações da Rota com múltiplos destinos */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Informações da Rota
                </h3>
                
                {/* Origem fixa */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Origem (Fixo)
                  </label>
                  <Input
                    type="text"
                    value={formData.origin}
                    readOnly
                    disabled
                    className="border-gray-300 bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">⚠️ Origem fixa do sistema</p>
                </div>

                {/* ✅ NOVO: Lista de destinos/waypoints */}
                <div className="space-y-3 mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Destinos e Paradas
                  </label>
                  {destinations.map((dest, index) => (
                    <div key={index} className="p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="font-medium text-gray-700">
                          {index === destinations.length - 1 ? 
                            `🎯 Destino Final` : 
                            `📍 Parada ${index + 1}`
                          }
                        </label>
                        {destinations.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeDestination(index)}
                            className="text-red-500 hover:bg-red-100 h-7 w-7"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select 
                          value={dest.state} 
                          onValueChange={(value) => handleDestinationChange(index, 'state', value)}
                        >
                          <SelectTrigger className="border-gray-300">
                            <SelectValue placeholder="Selecione o estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {states.map(state => (
                              <SelectItem key={state.ID} value={state.ID}>
                                {state.Nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <CityCombobox
                          value={dest.city}
                          onChange={(value) => handleDestinationChange(index, 'city', value)}
                          disabled={!dest.state || routeLoading}
                          cities={dest.state ? allCitiesData.filter(city => city.Estado == dest.state).sort((a, b) => a.Nome.localeCompare(b.Nome)) : []}
                          placeholder={!dest.state ? 'Selecione um estado primeiro' : 'Selecione a cidade'}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addDestination}
                  className="mb-4 border-dashed border-blue-400 text-blue-600 hover:bg-blue-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parada/Destino
                </Button>

                {/* Eixos e KM */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de Eixos do Veículo *
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleAxleChange(-1)}
                        disabled={axleCount <= 2}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <div className="w-full text-center font-bold text-lg text-gray-800 bg-white border border-gray-300 rounded-md py-1.5">
                        {axleCount} Eixos
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleAxleChange(1)}
                        disabled={axleCount >= 10}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* ✅ NOVO CAMPO: Valor do Combustível */}
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Combustível (R$/L)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.fuelPrice}
                      onChange={(e) => handleInputChange('fuelPrice', e.target.value)}
                      placeholder="Ex: 5.80"
                      className="border-gray-300"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consumo (Km/L)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.fuelEfficiency}
                      onChange={(e) => handleInputChange('fuelEfficiency', e.target.value)}
                      placeholder="Ex: 2.5"
                      className="border-gray-300"
                    />
                  </div> */}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distância Total (km) *
                    </label>
                    <Input
                      type="number"
                      value={formData.totalKm}
                      onChange={(e) => handleInputChange('totalKm', e.target.value)}
                      placeholder="Será preenchido após cálculo"
                      className="border-gray-300"
                      required
                      readOnly={routeData !== null}
                      disabled={routeLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Use o botão "Calcular Rota" para preencher automaticamente
                    </p>
                  </div>
                </div>

                {/* ✅ ALTERAÇÃO: Botão Calcular Rota */}
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={calculateRoute} // Changed from compareRoutes
                    disabled={routeLoading || destinations.filter(d => d.state && d.city).length === 0}
                    className="w-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 disabled:cursor-not-allowed"
                  >
                    {routeLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculando Rota...
                      </>
                    ) : (
                      <>
                        <Route className="mr-2 h-4 w-4" />
                        Calcular Rota
                      </>
                    )}
                  </Button>
                  {routeError && <p className="text-xs text-red-600 mt-1 text-center">{routeError}</p>}
                </div>
              </div>

              {/* ✅ SEÇÃO ALTERADA: Informações de Rotas (sem botões de seleção) */}
              {showComparison && routeComparison && (
                <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                  <h3 className="text-xl font-bold text-green-800 mb-4 text-center">
                    📊 Rota Completa (Origem a Todos os Pontos)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Rota Econômica */}
                    {routeComparison.routes.economic && (
                      <Card className="border-green-400 hover:shadow-lg transition-shadow">
                        <CardHeader className="bg-green-100">
                          <CardTitle className="flex flex-col sm:flex-row items-center justify-between gap-2 text-green-800">
                            <span className="text-lg sm:text-xl font-bold">Rota Mais Curta</span>
                            {/* Removed Select Button */}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Distância:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.economic.distance ? routeComparison.routes.economic.distance.toFixed(1) : '0.0'} km
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Duração:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.economic.duration ? 
                                `${Math.floor(routeComparison.routes.economic.duration)}h ${Math.round((routeComparison.routes.economic.duration % 1) * 60)}m` : 
                                '0h 0m'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Pedágios:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.economic.tollData?.tolls?.length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Custo Pedágio:</span>
                            <span className="font-bold text-xl text-red-600">
                              R$ ${(routeComparison.routes.economic.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {/* ✅ NOVO: Mostrar custo do combustível */}
                          {routeComparison.routes.economic.fuel && routeComparison.routes.economic.fuel.cost && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Combustível:</span>
                              <span className="font-bold text-xl text-orange-600">
                                R$ {routeComparison.routes.economic.fuel.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Rota Mais Curta */}
                    {routeComparison.routes.shortest && (
                      <Card className="border-blue-400 hover:shadow-lg transition-shadow">
                        <CardHeader className="bg-blue-100">
                          <CardTitle className="flex flex-col sm:flex-row items-center justify-between gap-2 text-blue-800">
                            <span className="text-lg sm:text-xl font-bold">Rota Econômica</span>
                            {/* Removed Select Button */}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Distância:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.shortest.distance ? routeComparison.routes.shortest.distance.toFixed(1) : '0.0'} km
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Duração:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.shortest.duration ? 
                                `${Math.floor(routeComparison.routes.shortest.duration)}h ${Math.round((routeComparison.routes.shortest.duration % 1) * 60)}m` : 
                                '0h 0m'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Pedágios:</span>
                            <span className="font-bold text-xl">
                              {routeComparison.routes.shortest.tollData?.tolls?.length || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Custo Pedágio:</span>
                            <span className="font-bold text-xl text-red-600">
                              R$ ${(routeComparison.routes.shortest.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {/* ✅ NOVO: Mostrar custo do combustível */}
                          {routeComparison.routes.shortest.fuel && routeComparison.routes.shortest.fuel.cost && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Combustível:</span>
                              <span className="font-bold text-xl text-orange-600">
                                R$ {routeComparison.routes.shortest.fuel.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Mapa com comparação */}
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                      <Map className="w-5 h-5 mr-2" />
                      Visualização da Rota Completa
                    </h4>
                    <RouteMapComponent
                      origin={routeComparison.origin.coordinates}
                      destination={routeComparison.destination.coordinates}
                      waypoints={routeComparison.waypoints}
                      economicRoute={routeComparison.routes.economic}
                      shortestRoute={routeComparison.routes.shortest}
                      height="450px"
                    />
                  </div>
                </div>
              )}
              
              {/* ✅ SEÇÃO CORRIGIDA: Distâncias Fracionadas */}
              {showComparison && routeComparison && routeComparison.fractionalRoutes && routeComparison.fractionalRoutes.length > 0 && (
                <div className="mt-6 bg-orange-50 rounded-lg p-6 border-2 border-orange-200">
                    <h3 className="text-xl font-bold text-orange-800 mb-4 text-center flex items-center justify-center">
                        <Route className="w-6 h-6 mr-3" />
                        Distâncias Fracionadas (Origem até cada Ponto)
                    </h3>
                    <div className="space-y-3">
                        {routeComparison.fractionalRoutes.map((fracRoute, index) => (
                            <Card key={index} className="bg-white hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="font-semibold text-gray-800 flex-grow">
                                       <Badge variant="outline" className="mr-2 border-orange-400 text-orange-700">{index + 1}</Badge>
                                       {fracRoute.destination.city}/{fracRoute.destination.state}
                                    </div>
                                    {fracRoute.data ? (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-6 gap-y-2 text-sm text-gray-700 w-full sm:w-auto">
                                            <span className="flex items-center font-medium">
                                                <MapPin className="w-4 h-4 mr-1.5 text-blue-500" />
                                                Distância: <span className="font-bold ml-1">
                                                  {fracRoute.data.distance ? fracRoute.data.distance.toFixed(1) : '0.0'} km
                                                </span>
                                            </span>
                                            <span className="flex items-center font-medium">
                                                <Receipt className="w-4 h-4 mr-1.5 text-red-500" />
                                                Pedágios: <span className="font-bold ml-1">
                                                  R$ {(fracRoute.data.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </span>
                                            {/* ✅ ADICIONADO: Informação de combustível fracionado */}
                                            {fracRoute.data.fuel && fracRoute.data.fuel.amount && (
                                              <span className="flex items-center font-medium">
                                                  <span className="w-4 h-4 mr-1.5 text-orange-500">⛽</span>
                                                  Combustível: <span className="font-bold ml-1">
                                                    {fracRoute.data.fuel.amount.toFixed(1)} L
                                                  </span>
                                              </span>
                                            )}
                                        </div>
                                    ) : (
                                         <p className="text-red-500 text-sm flex items-center">
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                            Não foi possível calcular esta perna.
                                         </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
              )}


              {/* ✅ NOVO: Seção de Detalhes dos Pedágios ATUALIZADA (only shows if routeData is selected) */}
              {tollDetails && routeData && ( // Only show if a route has been selected (i.e. routeData is populated)
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Receipt className="w-5 h-5 mr-2 text-orange-600" />
                    <h4 className="font-semibold text-gray-800">Detalhes dos Pedágios (Rota Completa Selecionada)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-orange-100">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {tollDetails.pointCount || 0}
                        </p>
                        <p className="text-sm text-gray-600">
                          Pedágio{(tollDetails.pointCount || 0) > 1 ? 's' : ''} na Rota
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-100">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {(tollDetails.totalCost || 0).toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: tollDetails.currency === 'BRL' ? 'BRL' : 'USD',
                            minimumFractionDigits: 2 
                          })}
                        </p>
                        <p className="text-sm text-gray-600">Custo Total (Tag)</p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-100">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {(tollDetails.pointCount || 0) > 0 ? 
                            ((tollDetails.totalCost || 0) / (tollDetails.pointCount || 1)).toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: tollDetails.currency === 'BRL' ? 'BRL' : 'USD',
                              minimumFractionDigits: 2 
                            }) : 'R$ 0,00'}
                        </p>
                        <p className="text-sm text-gray-600">Média por Pedágio</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lista dos pedágios */}
                  <div className="mt-4 max-h-32 overflow-y-auto">
                    <h5 className="font-medium text-gray-700 mb-2">Pedágios na rota:</h5>
                    <div className="space-y-1">
                      {(tollDetails.points || []).map((toll, index) => (
                        <div key={toll.id || index} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                          <div>
                            <span className="font-medium">{toll.name || `Pedágio ${index + 1}`}</span>
                            {toll.road && <span className="text-gray-500 ml-2">({toll.road})</span>}
                          </div>
                          <span className="font-bold text-orange-600">
                            {(toll.cost || 0)?.toLocaleString('pt-BR', { style: 'currency', currency: toll.currency || 'BRL', minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-3 p-2 bg-blue-50 rounded text-center">
                    <p className="text-sm text-blue-700 font-medium">
                      💡 Valores calculados para veículo tipo: {tollDetails.vehicleInfo?.type || `${axleCount} Eixos`}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Preços com tag eletrônica (Sem Parar, ConectCar, etc.)
                    </p>
                  </div>
                </div>
              )}

              {/* ✅ REMOVIDO: O bloco inteiro do mapa da rota selecionada foi removido. */}

              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <Weight className="w-5 h-5 mr-2 text-yellow-600" />
                  Carga e Valores
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Peso (kg) *
                    </label>
                    <div className="relative">
                      <Weight className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => {
                          if (e.target.value.length > 9) return;
                          handleInputChange('weight', e.target.value)
                        }}
                        placeholder="Ex: 15000"
                        className="pl-10 border-gray-300 focus:border-yellow-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor do Mapa (R$) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.mapValue}
                        onChange={(e) => {
                          if (e.target.value.length > 9) return;
                          handleInputChange('mapValue', e.target.value)
                        }}
                        placeholder="Ex: 2500.00"
                        className="pl-10 border-gray-300 focus:border-yellow-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* {currentUser && currentUser.userType !== 'carrier' && (
                <div className="bg-teal-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-teal-600" />
                    Gerentes e Valores
                  </h3>

                  {formData.mapValue && parseFloat(formData.mapValue) > 0 && (
                    <div className="mb-4 p-3 bg-white border border-teal-200 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-gray-600">Valor do Mapa</p>
                          <p className="font-bold text-teal-700">
                            R$ {parseFloat(formData.mapValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Total Gerentes</p>
                          <p className="font-bold text-blue-700">
                            R$ {calculateManagersTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Valor Restante</p>
                          <p className={`font-bold ${getRemainingValue() > 0 ? 'text-green-700' : 'text-red-700'}`}>
                            R$ {getRemainingValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              calculateManagersTotal() >= parseFloat(formData.mapValue)
                                ? 'bg-red-500'
                                : calculateManagersTotal() > parseFloat(formData.mapValue) * 0.8
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (calculateManagersTotal() / parseFloat(formData.mapValue)) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          {((calculateManagersTotal() / parseFloat(formData.mapValue)) * 100).toFixed(1)}% do valor total
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {managerFields.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Gerente
                          </label>
                          <Select value={field.gerente} onValueChange={(value) => handleManagerChange(index, 'gerente', value)}>
                            <SelectTrigger className="border-gray-300 bg-white">
                              <SelectValue placeholder="Selecione o gerente" />
                            </SelectTrigger>
                            <SelectContent>
                              {managerOptions.map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Valor (R$)
                            {formData.mapValue && index === managerFields.length - 1 && getRemainingValue() > 0 && (
                              <span className="text-xs text-green-600 ml-1">
                                (Máx: R$ {getRemainingValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                              </span>
                            )}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.valor}
                            onChange={(e) => handleManagerChange(index, 'valor', e.target.value)}
                            placeholder="0.00"
                            className="border-gray-300 bg-white focus:border-teal-500"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeManagerField(index)}
                          className="text-red-500 hover:bg-red-100 mt-5"
                          disabled={managerFields.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    onClick={addManagerField}
                    className={`mt-4 border-dashed ${
                      canAddMoreManagers()
                        ? 'border-teal-400 text-teal-600 hover:bg-teal-100 hover:text-teal-700'
                        : 'border-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!canAddMoreManagers()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Gerente
                    {!canAddMoreManagers() && formData.mapValue && calculateManagersTotal() >= parseFloat(formData.mapValue) && (
                      <span className="ml-2 text-xs">(Valor completo)</span>
                    )}
                  </Button>

                  {formData.mapValue && calculateManagersTotal() > 0 && calculateManagersTotal() < parseFloat(formData.mapValue) && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        ⚠️ Atenção: O valor total dos gerentes (R$ {calculateManagersTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor que o valor do mapa (R$ {parseFloat(formData.mapValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Considere ajustar ou adicionar mais gerentes.
                      </p>
                    </div>
                  )}

                  {formData.mapValue && calculateManagersTotal() > parseFloat(formData.mapValue) && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-800">
                        ❌ Erro: O valor total dos gerentes (R$ {calculateManagersTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede o valor do mapa (R$ {parseFloat(formData.mapValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                      </p>
                    </div>
                  )}
                </div>
              )} */}

              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-purple-600" />
                  Informações de Transporte
                </h3>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Caminhão *
                    </label>
                    {!formData.loadingMode ? (
                      <div className="p-3 bg-gray-100 border border-gray-300 rounded-md text-gray-500 text-center">
                        Selecione primeiro a "Modalidade de Carregamento" para ver os tipos de caminhão disponíveis
                      </div>
                    ) : getFilteredTruckTypes().length === 0 ? (
                      <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800 text-center">
                        Nenhum tipo de caminhão cadastrado para a modalidade "{
                          formData.loadingMode === 'paletizados' ? 'Paletizados' :
                          formData.loadingMode === 'bag' ? 'BAG' :
                          formData.loadingMode === 'granel' ? 'Granel' :
                          formData.loadingMode === 'bag_fracionado' ? 'BAG Fracionado' :
                          formData.loadingMode === 'paletizados_fracionado' ? 'Paletizados Fracionado' :
                          formData.loadingMode
                        }"
                      </div>
                    ) : (
                      <Select value={formData.truckType} onValueChange={(value) => handleInputChange('truckType', value)}>
                        <SelectTrigger className="border-gray-300">
                          <SelectValue placeholder="Selecione o tipo de caminhão" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredTruckTypes().map((truck) => (
                            <SelectItem key={truck.id} value={truck.name}>
                              <div className="flex items-center">
                                <Truck className="w-4 h-4 mr-2" />
                                {truck.name} ({truck.capacity}t - R${truck.baseRate}/km)
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Transportadoras * (Selecione uma ou mais)
                    </label>
                    <div className="border rounded-lg p-4 bg-white max-h-48 overflow-y-auto border-gray-300">
                      {carriers.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Nenhuma transportadora cadastrada</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {carriers
                            .filter(carrier => carrier.active)
                            .filter(carrier => {
                              if (!formData.loadingMode) return true;
                              const compatibleModality = getCompatibleModality(formData.loadingMode);
                              const carrierModalities = Array.isArray(carrier.modalities)
                                ? carrier.modalities
                                : (carrier.type ? [carrier.type] : []);
                              return carrierModalities.includes(compatibleModality);
                            })
                            .map((carrier) => {
                              const carrierModalities = Array.isArray(carrier.modalities)
                                ? carrier.modalities
                                : (carrier.type ? [carrier.type] : []);

                              return (
                                <div key={carrier.id} className="flex items-center space-x-3 p-2 hover:bg-purple-50 rounded">
                                  <Checkbox
                                    id={`carrier-${carrier.id}`}
                                    checked={formData.selectedCarriers.includes(carrier.name)}
                                    onCheckedChange={(checked) => handleCarrierToggle(carrier.name, checked)}
                                  />
                                  <label
                                    htmlFor={`carrier-${carrier.id}`}
                                    className="text-sm font-medium cursor-pointer flex-1"
                                  >
                                    <div className="flex items-center">
                                      🚛 <span className="ml-1">{carrier.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 block">
                                      {carrierModalities.map(mod =>
                                        mod === 'paletizados' ? 'Paletizados' :
                                        mod === 'bag' ? 'BAG' :
                                        mod === 'granel' ? 'Granel' :
                                        mod === 'bag_fracionado' ? 'BAG Fracionado' :
                                        mod === 'paletizados_fracionado' ? 'Paletizados Fracionado' :
                                        mod
                                      ).join(', ')}
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                    {formData.selectedCarriers.length > 0 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">
                          ✓ {formData.selectedCarriers.length} transportadora(s) selecionada(s):
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.selectedCarriers.map((carrierName, index) => (
                            <Badge key={index} className="bg-green-100 text-green-800">
                              {carrierName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Carregamento *
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left border-gray-300">
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.loadingDate ? format(formData.loadingDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.loadingDate}
                        onSelect={(date) => handleInputChange('loadingDate', date)}
                        locale={ptBR}
                        disabled={(date) => date < new Date().setHours(0, 0, 0, 0)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Roteiro
                </h3>
                <Textarea
                  value={formData.routeInfo}
                  onChange={(e) => handleInputChange('routeInfo', e.target.value)}
                  placeholder="Descreva informações adicionais sobre a rota, restrições, observações especiais..."
                  rows={4}
                  className="border-gray-300 focus:border-green-500"
                />
              </div>

              <div className="flex justify-center pt-6">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-12 py-4 text-lg shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Criando Cotação...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Plus className="w-6 h-6 mr-3" />
                      Criar Cotação
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {showImagePreview && formData.mapImage && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-5xl max-h-full">
              <Button
                onClick={() => setShowImagePreview(false)}
                className="absolute -top-4 -right-4 bg-white text-gray-800 hover:bg-gray-100 rounded-full p-3 shadow-lg z-10"
              >
                <X className="w-6 h-6" />
              </Button>
              <img
                src={formData.mapImage}
                alt="Mapa da Rota - Visualização Completa"
                className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
