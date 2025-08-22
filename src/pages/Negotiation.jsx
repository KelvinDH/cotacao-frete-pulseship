
import React, { useState, useEffect } from 'react';
import { HandshakeIcon, Percent, CheckCircle, DollarSign, Weight, MapPin, FileText, Truck, Route, CalendarDays, Search, ChevronDown, ChevronUp, Info, Send, XCircle, Users, Clock, AlertTriangle, Edit, Trash2, Map, Save, Ban, Upload, Eye, X, ChevronLeft, ChevronRight, ImageIcon, Loader2 } from "lucide-react";
import { FreightMap, Carrier, User, TruckType, UploadFile } from "@/components/ApiDatabase";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendEmail } from '../utils/sendEmail';
import { getBrazilIsoNow } from '../utils/getBrazilIsoNow';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import RouteMapComponent from '../components/RouteMapComponent';
import RouteDetails from '../components/RouteDetails';
import RouteStopsDisplay from '../components/RouteStopsDisplay';


export default function NegotiationPage() {
  const [freightMaps, setFreightMaps] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDetails, setExpandedDetails] = useState({});
  const [modalityFilter, setModalityFilter] = useState('all');
  
  // ✅ NOVO ESTADO: Para controlar cards expandidos
  const [expandedCards, setExpandedCards] = useState(new Set());
  
  // Estados para as funcionalidades
  const [carrierProposalInput, setCarrierProposalInput] = useState({});
  const [userCounterProposal, setUserCounterProposal] = useState({});
  const [justificationText, setJustificationText] = useState({});
  const [showJustificationModal, setShowJustificationModal] = useState({});
  const [finalizationObservation, setFinalizationObservation] = useState({});

  // Estados para edição da proposta (individual)
  const [editingProposalId, setEditingProposalId] = useState(null);
  const [proposalEditData, setProposalEditData] = useState({ mapValue: '', selectedCarrier: '', observation: '' });
  const [originalProposalData, setOriginalProposalData] = useState(null);

  // Estados para edição completa do MAPA (grupo de propostas)
  const [editingMapId, setEditingMapId] = useState(null); // Will now store the mapNumber
  const [editFormData, setEditFormData] = useState({}); // Will contain selectedCarriers: []
  const [originalEditData, setOriginalEditData] = useState(null); // Stores the original map group for comparison
  const [editObservation, setEditObservation] = useState(''); // For observation on map edit
  const [truckTypes, setTruckTypes] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false); // For edit modal image preview
  const [selectedImage, setSelectedImage] = useState(null); // For general image preview
  const [contractLoading, setContractLoading] = useState({}); // For individual freight action buttons

  // NOVOS ESTADOS PARA PAGINAÇÃO E FILTRO DE STATUS
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [statusFilter, setStatusFilter] = useState('negotiating'); // Default for admins, will be overridden for carriers in loadData

  // Helper para formatar a data para o fuso do Brasil (UTC-3)
  const formatToBrazilTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (!isValid(date)) return 'Data inválida';

      // Converte para o horário de Brasília (UTC-3)
      const brazilDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
      
      const day = String(brazilDate.getDate()).padStart(2, '0');
      const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
      const year = brazilDate.getFullYear();
      const hours = String(brazilDate.getHours()).padStart(2, '0');
      const minutes = String(brazilDate.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      console.error("Erro ao formatar data:", e);
      return 'Data inválida';
    }
  };

  // ✅ NOVA FUNÇÃO: Para renderizar informações detalhadas da rota (this was already there)
  // This function is defined but not used in the JSX, as per previous implementation logic.
  // The new RouteDetails component will handle displaying route information.
  const renderRouteInfo = (freight) => {
    if (!freight.routeData || !freight.routeData.route) {
      return (
        <div className="text-sm text-gray-500 flex items-center mt-2">
          <Route className="w-4 h-4 mr-1" />
          Informações de rota não disponíveis
        </div>
      );
    }

    const route = freight.routeData.route;
    const hasTolls = route.tollData && route.tollData.tolls && route.tollData.tolls.length > 0;

    return (
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="font-medium text-blue-800 mb-2 flex items-center">
          <Route className="w-4 h-4 mr-2" />
          Detalhes da Rota
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">📏</span>
            <span><strong>Distância:</strong> {route.distance?.toFixed(2) || freight.totalKm} km</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-600 mr-2">⏱️</span>
            {/* ✅ CORREÇÃO: Lógica para converter horas decimais em horas e minutos */}
            <span><strong>Duração:</strong> {route.duration ? `${Math.floor(route.duration)}h ${Math.round((route.duration % 1) * 60)}m` : 'N/A'}</span>
          </div>
          {hasTolls && (
            <>
              <div className="flex items-center">
                <span className="text-orange-500 mr-2">💰</span>
                <span><strong>Pedágios:</strong> {route.tollData.tolls.length} pontos</span>
              </div>
              <div className="flex items-center">
                <span className="text-red-600 mr-2">💵</span>
                <span><strong>Custo Total:</strong> R$ {route.tollData.totalCost?.toFixed(2) || '0,00'}</span>
              </div>
            </>
          )}
        </div>
        
        {hasTolls && (
          <div className="mt-3 border-t pt-2">
            <h6 className="font-medium text-orange-700 mb-2 text-sm">Pedágios na Rota:</h6>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {route.tollData.tolls.slice(0, 5).map((toll, index) => (
                <div key={toll.id || index} className="flex justify-between items-center text-xs bg-white p-2 rounded border">
                  <span className="font-medium">{toll.name}</span>
                  <span className="text-orange-600 font-bold">
                    R$ {toll.cost?.toFixed(2) || '0,00'}
                  </span>
                </div>
              ))}
              {route.tollData.tolls.length > 5 && (
                <div className="text-xs text-center text-gray-500 py-1">
                  ... e mais {route.tollData.tolls.length - 5} pedágios
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    loadData();
  }, []); 

  // Reset current page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm, modalityFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      // Carregar dados necessários para edição
      const [truckTypesList, carriersList] = await Promise.all([
        TruckType.list(),
        Carrier.list()
      ]);
      setTruckTypes(truckTypesList);
      setCarriers(carriersList);
      
      let mapsToShow = [];

      if (user && user.userType === 'carrier') {
        // Para transportadoras, exibir APENAS os fretes que estão ativamente em negociação.
        // It's crucial here that a carrier only sees freights *selected for them*
        const carrierMaps = await FreightMap.filter({ selectedCarrier: user.carrierName });
        // Filter by status for carrier view, typically negotiating
        mapsToShow = carrierMaps.filter(map => map.status === 'negotiating' || map.status === 'contracted' || map.status === 'rejected');
        setStatusFilter('negotiating'); // Define o filtro para corresponder aos dados carregados
      } else {
        // Admins/Users veem todos os fretes para gerenciamento
        const allMaps = await FreightMap.list();
        mapsToShow = allMaps;
        // The status filter will handle which ones are displayed from the full list
      }

      // Ordena todos os mapas por data de criação, mais recentes primeiro.
      mapsToShow.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      setFreightMaps(mapsToShow);
      
    } catch (error) {
      console.error("Error loading data:", error);
      setCurrentUser(null);
      setFreightMaps([]);
    }
    setLoading(false);
  };

  // ✅ NOVA FUNÇÃO: Para toggle de card
  const toggleCard = (mapNumber) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mapNumber)) {
        newSet.delete(mapNumber);
      } else {
        newSet.add(mapNumber);
      }
      return newSet;
    });
  };

  // Iniciar edição da proposta (individual, triggered by admin/user from a specific proposal card)
  const handleStartProposalEdit = (map) => {
    setEditingProposalId(map.id);
    const data = {
      mapValue: map.mapValue,
      selectedCarrier: map.selectedCarrier,
      observation: ''
    };
    setProposalEditData(data);
    setOriginalProposalData(data);
  };
  
  // Cancelar edição da proposta
  const handleCancelProposalEdit = () => {
    setEditingProposalId(null);
    setProposalEditData({ mapValue: '', selectedCarrier: '', observation: '' });
    setOriginalProposalData(null);
  };

  // Salvar edição da proposta (individual)
  const handleSaveProposalEdit = async (mapId) => {
    const map = freightMaps.find(m => m.id === mapId);
    if (!map) return;
  
    const valueChanged = parseFloat(proposalEditData.mapValue) !== parseFloat(originalProposalData.mapValue);
    const carrierChanged = proposalEditData.selectedCarrier !== originalProposalData.selectedCarrier;
  
    if ((valueChanged || carrierChanged) && !proposalEditData.observation.trim()) {
      alert('A observação é obrigatória ao alterar o valor ou a transportadora.');
      return;
    }
  
    try {
      const updateData = {
        mapValue: parseFloat(proposalEditData.mapValue),
        selectedCarrier: proposalEditData.selectedCarrier,
      };
  
      if (valueChanged || carrierChanged) {
        let details = [];
        if (valueChanged) {
          details.push(`Valor do mapa alterado de R$ ${originalProposalData.mapValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${parseFloat(proposalEditData.mapValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
        }
        if (carrierChanged) {
          details.push(`Transportadora alterada de "${originalProposalData.selectedCarrier}" para "${proposalEditData.selectedCarrier}".`);
        }
  
        const newObservation = {
          observation: proposalEditData.observation,
          user: currentUser.fullName,
          timestamp: new Date().toISOString(),
          details: details.join(' ')
        };
        updateData.editObservations = [...(map.editObservations || []), newObservation];
      }
  
      await FreightMap.update(mapId, updateData);
      alert('Proposta atualizada com sucesso!');
      handleCancelProposalEdit();
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar a edição da proposta:", error);
      alert("Falha ao salvar. Tente novamente.");
    }
  };

  // **** NEW MAP EDIT FUNCTIONS ****
  const handleEditMapOpen = (mapGroup) => {
    // mapGroup is [mapNumber, array_of_freight_maps_for_that_number]
    const mapNumber = mapGroup[0];
    const freightsInGroup = mapGroup[1];
    const mainFreight = freightsInGroup[0]; // Assumes common data is consistent across the group

    const allCarriersForMap = freightsInGroup.map(f => f.selectedCarrier);

    const initialData = {
      mapNumber: mainFreight.mapNumber,
      mapImage: mainFreight.mapImage,
      origin: mainFreight.origin,
      destination: mainFreight.destination,
      totalKm: mainFreight.totalKm,
      weight: mainFreight.weight,
      mapValue: mainFreight.mapValue,
      truckType: mainFreight.truckType,
      loadingMode: mainFreight.loadingMode,
      loadingDate: mainFreight.loadingDate ? parseISO(mainFreight.loadingDate) : null,
      routeInfo: mainFreight.routeInfo,
      managers: mainFreight.managers || [],
      selectedCarriers: allCarriersForMap, // MÚLTIPLAS TRANSPORTADORAS
    };
    
    setEditingMapId(mapNumber);
    setEditFormData(initialData);
    setOriginalEditData({ mapNumber: mapNumber, freights: [...freightsInGroup] }); // Store original map group
    setEditObservation('');
  };

  const closeEditMapModal = () => {
    setEditingMapId(null);
    setEditFormData({});
    setOriginalEditData(null);
    setEditObservation('');
  };

  const handleEditMapDataChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCarrierToggleInEdit = (carrierName) => {
    setEditFormData(prev => {
        const currentCarriers = prev.selectedCarriers || [];
        const newSelectedCarriers = currentCarriers.includes(carrierName)
            ? currentCarriers.filter(c => c !== carrierName)
            : [...currentCarriers, carrierName];
        return { ...prev, selectedCarriers: newSelectedCarriers };
    });
  };

  const handleEditMapSubmit = async () => {
    if (!editObservation.trim()) {
      alert("A justificativa de edição é obrigatória.");
      return;
    }
    if (!editFormData.selectedCarriers || editFormData.selectedCarriers.length === 0) {
      alert("Selecione pelo menos uma transportadora.");
      return;
    }

    setContractLoading(prev => ({ ...prev, mapEdit: true })); // Use a specific key for map edit
    try {
        const originalFreights = originalEditData.freights;
        const originalCarriers = originalFreights.map(f => f.selectedCarrier);
        const newSelectedCarriers = editFormData.selectedCarriers;

        const carriersToAdd = newSelectedCarriers.filter(c => !originalCarriers.includes(c));
        const carriersToRemove = originalCarriers.filter(c => !newSelectedCarriers.includes(c));
        const carriersToUpdate = originalCarriers.filter(c => !carriersToRemove.includes(c) && !carriersToAdd.includes(c)); // Only update existing ones not being removed/added

        const newObservationRecord = {
          observation: editObservation.trim(),
          user: currentUser.fullName,
          timestamp: getBrazilIsoNow(),
          details: 'Edição geral do mapa.'
        };

        const basePayload = {
            mapNumber: editFormData.mapNumber,
            mapImage: editFormData.mapImage,
            origin: editFormData.origin,
            destination: editFormData.destination,
            totalKm: parseInt(editFormData.totalKm),
            weight: parseFloat(editFormData.weight),
            mapValue: parseFloat(editFormData.mapValue),
            truckType: editFormData.truckType,
            loadingMode: editFormData.loadingMode,
            loadingDate: editFormData.loadingDate ? format(new Date(editFormData.loadingDate), 'yyyy-MM-dd') : null,
            routeInfo: editFormData.routeInfo,
            managers: editFormData.managers || [],
            updated_date: getBrazilIsoNow()
        };

        // 1. Adicionar novas transportadoras
        const creationPromises = carriersToAdd.map(carrierName => {
            const createPayload = {
                ...basePayload,
                selectedCarrier: carrierName,
                carrierProposals: {}, // New freights start with no proposals
                status: 'negotiating', // New freights start as negotiating
                created_date: getBrazilIsoNow(),
                editObservations: [newObservationRecord], // New observation for this created freight
                created_by: currentUser.fullName // Set created_by for new freights
            };
            return FreightMap.create(createPayload);
        });

        // 2. Remover transportadoras antigas
        const deletionPromises = carriersToRemove.map(carrierName => {
            const freightToRemove = originalFreights.find(f => f.selectedCarrier === carrierName);
            if (freightToRemove) {
                return FreightMap.delete(freightToRemove.id);
            }
            return Promise.resolve();
        });

        // 3. Atualizar dados para transportadoras existentes
        const updatePromises = carriersToUpdate.map(carrierName => {
            const freightToUpdate = originalFreights.find(f => f.selectedCarrier === carrierName);
            if (freightToUpdate) {
                const updatePayload = { 
                  ...basePayload,
                  // Preserve individual carrier data
                  carrierProposals: freightToUpdate.carrierProposals,
                  status: freightToUpdate.status,
                  selectedCarrier: freightToUpdate.selectedCarrier, // Ensure the selected carrier remains the same
                  // Append new observation
                  editObservations: [...(freightToUpdate.editObservations || []), newObservationRecord],
                  created_by: freightToUpdate.created_by // Preserve original created_by
                };
                return FreightMap.update(freightToUpdate.id, updatePayload);
            }
            return Promise.resolve();
        });

        await Promise.all([...creationPromises, ...deletionPromises, ...updatePromises]);
        
        alert('Mapa atualizado com sucesso!');
        closeEditMapModal();
        await loadData();
    } catch (error) {
        console.error("Erro ao atualizar mapa:", error);
        alert('Falha ao atualizar o mapa.');
    } finally {
        setContractLoading(prev => ({ ...prev, mapEdit: false }));
    }
  };
  // **** END NEW MAP EDIT FUNCTIONS ****

  // Upload de imagem na edição
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // Simulating API call for UploadFile
      // In a real application, you would send the file to your backend here
      // For demonstration, we'll just create a dummy URL
      const file_url = URL.createObjectURL(file); 
      setEditFormData(prev => ({ ...prev, mapImage: file_url }));
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Remover imagem na edição
  const removeEditImage = () => {
    setEditFormData(prev => ({ ...prev, mapImage: '' }));
  };

  // Filtrar tipos de caminhão por modalidade
  const getFilteredTruckTypes = (loadingMode) => {
    const compatibleModality = loadingMode === 'bag_fracionado' ? 'bag' : 
                               loadingMode === 'paletizados_fracionado' ? 'paletizados' : 
                               loadingMode;
    return truckTypes.filter(truck => truck.modality === compatibleModality);
  };


  // Funções de Ação
  const handleCarrierProposalSubmit = async (freightId) => {
    const proposalValue = carrierProposalInput[freightId]; 
    if (!proposalValue || parseFloat(proposalValue) <= 0) {
      alert('Por favor, insira um valor de proposta válido.');
      return;
    }

    const freight = freightMaps.find(map => map.id === freightId);
    const mapValue = parseFloat(freight.mapValue);
    const proposalValueNum = parseFloat(proposalValue);

    if (proposalValueNum > mapValue) {
      alert(`A proposta não pode ser maior que o valor do mapa (R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      return;
    }

    setContractLoading(prev => ({ ...prev, [freightId]: true }));
    try {
      const updatedProposals = { ...freight.carrierProposals, [currentUser.carrierName]: proposalValueNum };
      await FreightMap.update(freightId, { carrierProposals: updatedProposals });

      // ENVIAR EMAIL PARA ADMINISTRADORES/USUÁRIOS
      try {
        // Buscar usuários do tipo admin e user para notificar
        const users = await User.list();
        const adminsAndUsers = users.filter(user => 
          (user.userType === 'admin' || user.userType === 'user') && user.active
        );

        const emailPromises = adminsAndUsers.map(async (user) => {
          const emailSubject = `💰 Nova Proposta Recebida - Mapa ${freight.mapNumber}`;
          const emailBody = `
            <h2>Olá, ${user.fullName}!</h2>
            <p>Uma nova proposta foi recebida:</p>
            
            <h3>📋 DETALHES:</h3>
            <ul>
              <li><strong>Mapa:</strong> ${freight.mapNumber}</li>
              <li><strong>Transportadora:</strong> ${currentUser.carrierName}</li>
              <li><strong>Proposta:</strong> R$ ${proposalValueNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</li>
              <li><strong>Valor do Mapa:</strong> R$ ${mapValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</li>
              <li><strong>Percentual:</strong> ${((proposalValueNum / mapValue) * 100).toFixed(1)}%</li>
              <li><strong>Rota:</strong> ${freight.origin} → ${freight.destination}</li>
            </ul>
            
            <p>🔍 <strong>Acesse o sistema na aba "Negociação" para analisar e tomar uma decisão.</strong></p>
            
            <p>Atenciosamente,<br>Sistema UnionAgro</p>
          `;

          return sendEmail({
            to: user.email,
            subject: emailSubject,
            html: emailBody
          });
        });

        // Aguarda todos os emails serem enviados
        await Promise.all(emailPromises);
        console.log('Emails enviados para administradores com sucesso!');
      } catch (emailError) {
        console.error('Erro ao enviar emails para administradores:', emailError);
        // Não bloqueia o fluxo se houver erro no email
      }

      setCarrierProposalInput(prev => ({ ...prev, [freightId]: '' }));
      await loadData();
      alert('Proposta enviada com sucesso! Os administradores foram notificados por email.');
    } catch (error) {
      console.error("Error saving carrier proposal:", error);
      alert("Erro ao enviar proposta. Tente novamente.");
    } finally {
      setContractLoading(prev => ({ ...prev, [freightId]: false }));
    }
  };

  // Função para encontrar a menor proposta de um grupo de mapas
  const getLowestProposalForMapGroup = (mapsInGroup) => {
    let lowestValue = Infinity;
    let lowestCarrier = null;

    mapsInGroup.forEach(map => {
      if (map.carrierProposals && map.carrierProposals[map.selectedCarrier]) {
        const proposalValue = map.carrierProposals[map.selectedCarrier];
        if (proposalValue < lowestValue) {
          lowestValue = proposalValue;
          lowestCarrier = map.selectedCarrier;
        }
      }
    });

    return { lowestValue, lowestCarrier };
  };

  const handleUserCounterProposalAndFinalize = async (freightId) => {
    const counterValue = userCounterProposal[freightId];
    if (!counterValue || parseFloat(counterValue) <= 0) {
      alert('Por favor, insira um valor de contraproposta válido.');
      return;
    }

    const freight = freightMaps.find(map => map.id === freightId);
    if (!freight || !freight.selectedCarrier) {
      alert('Erro: Transportadora não identificada para este frete.');
      return;
    }

    const carrierProposalValue = freight.carrierProposals?.[freight.selectedCarrier];
    if (carrierProposalValue && parseFloat(counterValue) > carrierProposalValue) {
      alert(`O valor final não pode ser maior que a proposta da transportadora (R$ ${carrierProposalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
      return;
    }

    // Encontrar todas as propostas do mesmo mapa
    const mapsInGroup = freightMaps.filter(m => m.mapNumber === freight.mapNumber);
    const { lowestValue, lowestCarrier } = getLowestProposalForMapGroup(mapsInGroup);

    // Verificar se não está escolhendo a mais barata
    const isChoosingCheapest = freight.selectedCarrier === lowestCarrier;
     
    if (!isChoosingCheapest && lowestCarrier && lowestValue !== Infinity) { // Added condition to check if lowestValue is actually found
      // Mostrar modal de justificativa
      setShowJustificationModal(prev => ({ ...prev, [freightId]: true }));
      return;
    }

    // Se é a mais barata ou não há outras propostas, finalizar diretamente
    await finalizeFreight(freightId, counterValue, '');
  };

  const finalizeFreight = async (freightId, counterValue, justification = '') => {
    const freight = freightMaps.find(map => map.id === freightId);

    setContractLoading(prev => ({ ...prev, [freightId]: true }));
    try {
      const updateData = {
        finalValue: parseFloat(counterValue),
        status: 'contracted',
        contractedAt: new Date().toISOString()
      };

      if (justification.trim()) {
        updateData.justification = justification.trim();
      }

      if (finalizationObservation[freightId]?.trim()) {
        updateData.finalizationObservation = finalizationObservation[freightId].trim();
      }

      await FreightMap.update(freightId, updateData);
      
      // LÓGICA CORRIGIDA: Atualiza o status dos perdedores em vez de deletar
      const mapsInGroup = freightMaps.filter(m => m.mapNumber === freight.mapNumber);
      for (const otherMap of mapsInGroup) {
        if (otherMap.id !== freightId) {
          await FreightMap.update(otherMap.id, { 
            status: 'rejected',
            rejectedReason: 'Outra proposta foi aceita para este mapa.' 
          });
        }
      }

      // ENVIAR EMAIL PARA A TRANSPORTADORA CONTRATADA
      try {
        const users = await User.list();
        const contractedCarrierUser = users.find(user => 
          user.userType === 'carrier' && 
          user.carrierName === freight.selectedCarrier && 
          user.active
        );

        if (contractedCarrierUser) {
          const contractEmailSubject = `🎉 Parabéns! Frete Contratado - Mapa ${freight.mapNumber}`;
          const contractEmailBody = `
            <h2>🎉 Parabéns, ${contractedCarrierUser.fullName}!</h2>
            <p><strong>Seu frete foi aprovado e contratado!</strong></p>
            
            <h3>📋 DETALHES DO FRETE CONTRATADO:</h3>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Mapa:</strong> ${freight.mapNumber}</li>
                <li><strong>Rota:</b> ${freight.origin} → ${freight.destination}</li>
                <li><strong>Distância:</strong> ${freight.totalKm} km</li>
                <li><strong>Peso:</strong> ${freight.weight?.toLocaleString('pt-BR')} kg</li>
                <li><strong>Valor Final Contratado:</strong> <span style="color: #059669; font-weight: bold;">R$ ${parseFloat(counterValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></li>
                <li><strong>Tipo de Caminhão:</strong> ${freight.truckType}</li>
                <li><strong>Modalidade:</strong> ${
                  freight.loadingMode === 'paletizados' ? 'Paletizados' : 
                  freight.loadingMode === 'bag' ? 'BAG' : 
                  freight.loadingMode === 'granel' ? 'Granel' : 
                  freight.loadingMode === 'bag_fracionado' ? 'BAG Fracionado' : 
                  'Paletizados Fracionado'
                }</li>
                <li><strong>Data de Carregamento:</strong> ${freight.loadingDate ? format(parseISO(freight.loadingDate), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'}</li>
              </ul>
            </div>
            
            ${justification ? `
            <h3>📝 Observações:</h3>
            <div style="background-color: #fef3c7; padding: 10px; border-radius: 6px; font-style: italic;">
              "${justification}"
            </div>
            ` : ''}

            ${updateData.finalizationObservation ? `
            <h3>📄 Observações da Finalização:</h3>
            <div style="background-color: #e0f2f7; padding: 10px; border-radius: 6px; font-style: italic;">
              "${updateData.finalizationObservation}"
            </div>
            ` : ''}
            
            <h3>🚚 Próximos Passos:</h3>
            <ol style="padding-left: 20px;">
              <li>Confirme a disponibilidade do caminhão para a data de carregamento</li>
              <li>Entre em contato com nossa equipe para coordenar os detalhes</li>
              <li>Após a entrega, anexe os documentos fiscais no sistema</li>
            </ol>
            
            <p style="margin-top: 20px;"><strong>Parabéns pela parceria e bom frete!</strong></p>
            
            <p>Atenciosamente,<br>Equipe UnionAgro</p>
          `;

          await sendEmail({
            to: contractedCarrierUser.email,
            subject: contractEmailSubject,
            html: contractEmailBody
          });
        }

        // ENVIAR EMAILS PARA AS TRANSPORTADORAS NÃO SELECIONADAS
        const rejectedCarrierEmails = mapsInGroup.filter(m => m.id !== freightId).map(async (rejectedMap) => {
          const rejectedCarrierUser = users.find(user => 
            user.userType === 'carrier' && 
            user.carrierName === rejectedMap.selectedCarrier && 
            user.active
          );

          if (rejectedCarrierUser) {
            const rejectionEmailSubject = `📋 Resultado da Cotação - Mapa ${freight.mapNumber}`;
            const rejectionEmailBody = `
              <h2>Olá, ${rejectedCarrierUser.fullName}</h2>
              <p>Informamos sobre o resultado da cotação do Mapa ${freight.mapNumber}:</p>
              
              <h3>📋 DETALHES DA COTAÇÃO:</h3>
              <ul>
                <li><strong>Mapa:</strong> ${freight.mapNumber}</li>
                <li><strong>Rota:</strong> ${freight.origin} → ${freight.destination}</li>
                <li><strong>Distância:</strong> ${freight.totalKm} km</li>
                <li><strong>Peso:</strong> ${freight.weight?.toLocaleString('pt-BR')} kg</li>
                <li><strong>Modalidade:</strong> ${
                  freight.loadingMode === 'paletizados' ? 'Paletizados' : 
                  freight.loadingMode === 'bag' ? 'BAG' : 
                  freight.loadingMode === 'granel' ? 'Granel' : 
                  freight.loadingMode === 'bag_fracionado' ? 'BAG Fracionado' : 
                  'Paletizados Fracionado'
                }</li>
              </ul>
              
              <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">📢 Resultado:</h3>
                <p style="margin-bottom: 0;"><strong>Infelizmente, desta vez outra proposta foi selecionada para esta cotação.</strong></p>
              </div>
              
              <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                <h3 style="color: #1d4ed8; margin-top: 0;">💪 Não desanime!</h3>
                <p style="margin-bottom: 0;">Continue participando de nossas cotações. Cada experiência nos ajuda a melhorar e encontrar as melhores oportunidades para sua transportadora!</p>
              </div>
              
              <p>🚛 <strong>Fique atento às próximas cotações no sistema!</strong></p>
              
              <p>Atenciosamente,<br>Equipe UnionAgro</p>
            `;

            return sendEmail({
              to: rejectedCarrierUser.email,
              subject: rejectionEmailSubject,
              html: rejectionEmailBody
            });
          }
          return null; // Return null for carriers without users or inactive
        });

        // Aguarda todos os emails de rejeição serem enviados
        await Promise.all(rejectedCarrierEmails.filter(Boolean));

        console.log('Emails de contratação e rejeição enviados com sucesso!');
      } catch (emailError) {
        console.error('Erro ao enviar emails de contratação/rejeição:', emailError);
        // Não bloqueia o fluxo principal se houver erro no email
      }
      
      setUserCounterProposal(prev => ({ ...prev, [freightId]: '' }));
      setJustificationText(prev => ({ ...prev, [freightId]: '' }));
      setFinalizationObservation(prev => ({ ...prev, [freightId]: '' }));
      setShowJustificationModal(prev => ({ ...prev, [freightId]: false }));
      
      alert(`Frete contratado com sucesso! As transportadoras foram notificadas por email.`);
      await loadData();
    } catch (error) {
      console.error("Error finalizing freight:", error);
      alert("Erro ao finalizar frete. Tente novamente.");
    } finally {
      setContractLoading(prev => ({ ...prev, [freightId]: false }));
    }
  };

  const handleJustificationSubmit = (freightId) => {
    const justification = justificationText[freightId];
    if (!justification || justification.trim().length < 10) {
      alert('Por favor, forneça uma justificativa com pelo menos 10 caracteres.');
      return;
    }

    const counterValue = userCounterProposal[freightId];
    finalizeFreight(freightId, counterValue, justification);
  };

  const cancelJustification = (freightId) => {
    setShowJustificationModal(prev => ({ ...prev, [freightId]: false }));
    setJustificationText(prev => ({ ...prev, [freightId]: '' }));
  };
  
  const handleRejectFreight = async (freightId) => {
    const freight = freightMaps.find(map => map.id === freightId);
    if (!window.confirm(`Confirma que NÃO deseja fechar o frete com ${freight.selectedCarrier}? A transportadora será notificada.`)) return;

    setContractLoading(prev => ({ ...prev, [freightId]: true }));
    try {
      await FreightMap.update(freightId, { 
        status: 'rejected',
        rejectedReason: 'Rejeitado pelo cliente'
      });

      // ENVIAR EMAIL PARA A TRANSPORTADORA REJEITADA
      try {
        const users = await User.list();
        const rejectedCarrierUser = users.find(user => 
          user.userType === 'carrier' && 
          user.carrierName === freight.selectedCarrier && 
          user.active
        );

        if (rejectedCarrierUser) {
          const rejectionEmailSubject = `📋 Resultado da Cotação - Mapa ${freight.mapNumber}`;
          const rejectionEmailBody = `
            <h2>Olá, ${rejectedCarrierUser.fullName}</h2>
            <p>Informamos sobre o resultado da sua proposta para o Mapa ${freight.mapNumber}:</p>
            
            <h3>📋 DETALHES DA COTAÇÃO:</h3>
            <ul>
              <li><strong>Mapa:</strong> ${freight.mapNumber}</li>
              <li><strong>Rota:</strong> ${freight.origin} → ${freight.destination}</li>
              <li><strong>Distância:</strong> ${freight.totalKm} km</li>
              <li><strong>Peso:</strong> ${freight.weight?.toLocaleString('pt-BR')} kg</li>
              <li><strong>Modalidade:</strong> ${
                  freight.loadingMode === 'paletizados' ? 'Paletizados' : 
                  freight.loadingMode === 'bag' ? 'BAG' : 
                  freight.loadingMode === 'granel' ? 'Granel' : 
                  freight.loadingMode === 'bag_fracionado' ? 'BAG Fracionado' : 
                  'Paletizados Fracionado'
                }</li>
              <li><strong>Sua Proposta:</strong> R$ ${freight.carrierProposals?.[freight.selectedCarrier]?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}</li>
            </ul>
            
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
              <h3 style="color: #dc2626; margin-top: 0;">📢 Resultado:</h3>
              <p style="margin-bottom: 0;"><strong>Infelizmente, desta vez o cliente optou por não seguir com sua proposta.</strong></p>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
              <h3 style="color: #1d4ed8; margin-top: 0;">💪 Não desanime!</h3>
              <p style="margin-bottom: 0;">Continue participando de nossas cotações. Cada experiência nos ajuda a melhorar e encontrar as melhores oportunidades para sua transportadora!</p>
            </div>
            
            <p>🚛 <strong>Fique atento às próximas cotações no sistema!</strong></p>
            
            <p>Atenciosamente,<br>Equipe UnionAgro</p>
          `;

          await sendEmail({
            to: rejectedCarrierUser.email,
            subject: rejectionEmailSubject,
            html: rejectionEmailBody
          });

          console.log('Email de rejeição enviado com sucesso!');
        }
      } catch (emailError) {
        console.error('Erro ao enviar email de rejeição:', emailError);
        // Não bloqueia o fluxo principal se houver erro no email
      }

      alert(`Frete rejeitado. ${freight.selectedCarrier} foi notificada por email.`);
      await loadData();
    } catch (error) {
      console.error("Erro ao rejeitar frete:", error);
      alert("Erro ao rejeitar frete. Tente novamente.");
    } finally {
      setContractLoading(prev => ({ ...prev, [freightId]: false }));
    }
  };

  const handleDeleteFreight = async (freightId, mapNumber) => {
    // Busca todos os fretes com o mesmo número de mapa
    const mapsToDelete = freightMaps.filter(f => f.mapNumber === mapNumber);
    
    if (window.confirm(`Tem certeza que deseja excluir permanentemente o mapa ${mapNumber} e TODAS as suas ${mapsToDelete.length} propostas associadas? Esta ação é irreversível.`)) {
      try {
        // Deleta todos os fretes associados em paralelo
        await Promise.all(mapsToDelete.map(map => FreightMap.delete(map.id)));
        
        alert(`Mapa ${mapNumber} e todas as suas propostas foram excluídos com sucesso.`);
        await loadData();
      } catch (error) {
        console.error("Erro ao excluir frete:", error);
        alert("Ocorreu um erro ao excluir o frete.");
      }
    }
  };

  // Funções Auxiliares
  const getGroupedFreights = () => {
    const grouped = freightMaps.reduce((acc, freight) => {
      if (!acc[freight.mapNumber]) {
        acc[freight.mapNumber] = [];
      }
      acc[freight.mapNumber].push(freight);
      return acc;
    }, {});

    const filteredGroups = Object.entries(grouped)
      .filter(([mapNumber, group]) => {
        const mainFreightForFilters = group[0]; // Use the first freight in the group for common filters
        
        // Filter by carrier if current user is a carrier
        if (currentUser && currentUser.userType === 'carrier') {
          const hasCarrierFreight = group.some(f => f.selectedCarrier === currentUser.carrierName);
          if (!hasCarrierFreight) return false;
        }

        const searchMatch = !searchTerm ||
          mapNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mainFreightForFilters.origin && mainFreightForFilters.origin.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (mainFreightForFilters.destination && mainFreightForFilters.destination.toLowerCase().includes(searchTerm.toLowerCase())) ||
          group.some(f => f.selectedCarrier && f.selectedCarrier.toLowerCase().includes(searchTerm.toLowerCase()));

        const statusMatch = statusFilter === 'all' || 
          (statusFilter === 'with_proposals' && group.some(f => f.carrierProposals && Object.keys(f.carrierProposals).length > 0)) ||
          (statusFilter === 'without_proposals' && group.every(f => !f.carrierProposals || Object.keys(f.carrierProposals).length === 0)) ||
          group.some(f => f.status === statusFilter); // Checks if ANY freight in the group matches the status

        const modalityMatch = modalityFilter === 'all' || mainFreightForFilters.loadingMode === modalityFilter;

        return searchMatch && statusMatch && modalityMatch;
      })
      .sort(([mapNumberA, groupA], [mapNumberB, groupB]) => {
        // Sort by the created date of the first item in the group (which should be consistent)
        return new Date(groupB[0].created_date) - new Date(groupA[0].created_date);
      });

    return filteredGroups;
  };

  // Aplicar paginação
  const getPaginatedFreights = () => {
    const allGroups = getGroupedFreights();
    const totalItems = allGroups.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Adjust current page if it's out of bounds
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedGroups = allGroups.slice(startIndex, endIndex);
    
    return {
      groups: paginatedGroups,
      totalItems,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  };

  const paginationData = getPaginatedFreights();
  
  // Navegar páginas
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= paginationData.totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleDetails = (mapNumber) => {
    setExpandedDetails(prev => ({ ...prev, [mapNumber]: !prev[mapNumber] }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'negotiating':
        return 'bg-blue-100 text-blue-800';
      case 'contracted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'negotiating':
        return 'Em Negociação';
      case 'contracted':
        return 'Contratado';
      case 'rejected':
        return 'Encerrado';
      default:
        return 'Desconhecido';
    }
  };

  const getModalityText = (modality) => {
    switch (modality) {
      case 'paletizados': return '📦 Paletizados';
      case 'bag': return '🎒 BAG';
      case 'granel': return '🌾 Granel';
      case 'bag_fracionado': return '🎒 BAG Fracionado';
      case 'paletizados_fracionado': return '📦 Paletizados Fracionado';
      default: return modality;
    }
  };

  // Renderização
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-lg text-gray-600">Carregando negociações...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {currentUser && currentUser.userType !== 'carrier' && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="negotiating">Em Negociação</SelectItem>
                  <SelectItem value="contracted">Contratados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                  <SelectItem value="with_proposals">Com Propostas</SelectItem>
                  <SelectItem value="without_proposals">Sem Propostas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar modalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Modalidades</SelectItem>
                  <SelectItem value="paletizados">📦 Paletizados</SelectItem>
                  <SelectItem value="bag">🎒 BAG</SelectItem>
                  <SelectItem value="granel">🌾 Granel</SelectItem>
                  <SelectItem value="bag_fracionado">🎒 BAG Fracionado</SelectItem>
                  <SelectItem value="paletizados_fracionado">📦 Paletizados Fracionado</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por mapa, origem, destino ou transportadora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full"
            />
          </div>
        </div>
      </div>

      {paginationData.groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-lg shadow-md">
          <HandshakeIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold">
            {searchTerm || modalityFilter !== 'all' || statusFilter !== 'negotiating' ? 'Nenhum frete encontrado' : 'Nenhum frete em negociação'}
          </h3>
          <p className="mt-2">
            {searchTerm || modalityFilter !== 'all' || statusFilter !== 'negotiating' ? 'Tente uma busca diferente ou ajuste o filtro.' : 'Novas cotações aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <>
          {/* INFORMAÇÕES DE PAGINAÇÃO */}
          <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
            <p>
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, paginationData.totalItems)} de {paginationData.totalItems} mapa(s)
            </p>
            <p>Página {currentPage} de {paginationData.totalPages}</p>
          </div>

          <div className="space-y-8">
            {paginationData.groups.map(([mapNumber, mapsInGroup]) => {
              const firstMap = mapsInGroup[0];
              const isDetailsExpanded = expandedDetails[mapNumber];
              const isCardExpanded = expandedCards.has(mapNumber); // ✅ NOVO: Check if card is expanded
              const { lowestValue, lowestCarrier } = getLowestProposalForMapGroup(mapsInGroup);
              const groupHasNewProposals = mapsInGroup.some(map => Object.keys(map.carrierProposals || {}).length > 0);

              return (
                <Card key={mapNumber} className="overflow-hidden shadow-lg border-2 border-transparent hover:border-blue-300 transition-all duration-300">
                  <CardHeader 
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4 cursor-pointer"
                    onClick={() => toggleCard(mapNumber)} // ✅ NOVO: Click handler para expandir/colapsar
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl font-bold text-gray-800 flex flex-wrap items-center gap-2">
                          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                            Mapa {mapNumber}
                          </span>
                          <Badge className={`${getStatusColor(firstMap.status)} text-xs`}>
                            {getStatusText(firstMap.status)}
                          </Badge>
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            {getModalityText(firstMap.loadingMode)}
                          </Badge>
                          {groupHasNewProposals && firstMap.status === 'negotiating' && (
                            <Badge className="bg-green-100 text-green-800 text-xs animate-pulse">
                              ✨ Nova Proposta
                            </Badge>
                          )}
                        </CardTitle>
                        {/* ✅ NOVO: Informação de quem cotou */}
                        {firstMap.created_by && firstMap.created_by !== 'system' && (
                          <div className="flex items-center text-gray-600 font-small mt-2 pb-2 border-b">
                            <Users className="w-4 h-4 mr-2 text-indigo-500" />
                            <span>Cotado por: {firstMap.created_by}</span>
                          </div>
                        )}
                        <p className="text-gray-600 mt-2 text-sm flex items-center flex-wrap gap-x-3 gap-y-1">
                          <span className="font-medium">{firstMap.origin}</span> → <span className="font-medium">{firstMap.destination}</span>
                          <span className="mx-1">•</span>
                          <span>{firstMap.totalKm} km</span>
                          <span className="mx-1">•</span>
                          <span>{firstMap.weight?.toLocaleString('pt-BR')} kg</span>
                          <span className="mx-1">•</span>
                          <Clock className="w-3 h-3" />
                          {currentUser?.userType !== 'carrier' && (
                            <span className="text-xs text-gray-500">Criado em: {formatToBrazilTime(firstMap.created_date)}</span>
                          )}
                        </p>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-2">
                        {currentUser?.userType !== 'carrier' && editingMapId !== mapNumber && ( 
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleEditMapOpen([mapNumber, mapsInGroup]); }} // ✅ ALTERADO: Prevent card toggle
                            className="bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Mapa
                          </Button>
                        )}
                        {currentUser && currentUser.userType === 'admin' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDeleteFreight(firstMap.id, firstMap.mapNumber); }} // ✅ ALTERADO: Prevent card toggle
                            className="shrink-0"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir
                          </Button>
                        )}
                        {/* ✅ NOVO: Ícone de expansão/colapso */}
                        <div className="flex items-center">
                          {isCardExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                {/* ✅ ALTERADO: Condicionalmente mostrar conteúdo baseado no estado de expansão */}
                {isCardExpanded && (
                <CardContent className="p-0"> {/* Adjusted padding here for new grid layout */}
                  {/* ✅ LAYOUT AJUSTADO: Grid com 2 colunas para melhor distribuição */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                    
                    {/* ✅ COLUNA ESQUERDA: Informações básicas */}
                    <div className="space-y-4">
                      {/* Informações Básicas do Frete */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                          <FileText className="w-4 h-4 mr-2 text-blue-600" />
                          Informações do Frete
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Origem:</span>
                            <p className="font-medium">{firstMap.origin}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Destino:</span>
                            <p className="font-medium">{firstMap.destination}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Distância:</span>
                            <p className="font-medium">{firstMap.totalKm} km</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Peso:</span>
                            <p className="font-medium">{firstMap.weight?.toLocaleString('pt-BR')} kg</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Tipo de Caminhão:</span>
                            <p className="font-medium">{firstMap.truckType}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Modalidade:</span>
                            <p className="font-medium">{getModalityText(firstMap.loadingMode)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Data de Carregamento:</span>
                            <p className="font-medium">{firstMap.loadingDate ? format(new Date(firstMap.loadingDate), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada'}</p>
                          </div>
                          {currentUser?.userType !== 'carrier' && (
                            <div>
                              <span className="text-gray-600">Valor do Mapa:</span>
                              <p className="font-medium text-green-600">R$ {firstMap.mapValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          )}
                        </div>
                        
                        {firstMap.routeInfo && (
                          <div className="mt-3 pt-3 border-t">
                            <span className="text-gray-600 text-sm">Observações da Rota:</span>
                            <p className="text-sm mt-1">{firstMap.routeInfo}</p>
                          </div>
                        )}
                      </div>

{/*                       
                      {(currentUser?.userType === 'admin' || currentUser?.userType === 'user') && firstMap.managers && firstMap.managers.length > 0 && (
                        <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <Users className="w-4 h-4 mr-2 text-teal-600" />
                            Gerentes Responsáveis
                          </h4>
                          <div className="space-y-2">
                            {firstMap.managers.map((manager, index) => (
                              <div key={index} className="flex justify-between items-center bg-white p-2 rounded border">
                                <span className="font-medium">{manager.gerente}</span>
                                <span className="text-teal-600 font-bold">R$ {parseFloat(manager.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )} */}

                      {/* Re-insert: Indicador da menor proposta */}
                      {lowestCarrier && currentUser?.userType !== 'carrier' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            <strong>Menor proposta:</strong> {lowestCarrier} - R$ {lowestValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ✅ COLUNA DIREITA: Imagem */}
                    <div className="space-y-4">
                      {/* Imagem do Mapa */}
                      {firstMap.mapImage && (
                        <div className="bg-white rounded-lg p-4 border">
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <ImageIcon className="w-4 h-4 mr-2 text-purple-600" />
                            Mapa da Rota
                          </h4>
                          <div className="relative">
                            <img
                              src={firstMap.mapImage}
                              alt="Mapa da Rota"
                              className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setSelectedImage(firstMap.mapImage)}
                            />
                            <Button
                              size="sm"
                              onClick={() => setSelectedImage(firstMap.mapImage)}
                              className="absolute top-2 right-2 bg-white/90 text-gray-700 hover:bg-white"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                
                {/* ✅ ALTERAÇÃO: Comparação de Rotas - agora ocupa largura total */}
                {(currentUser?.userType === 'admin' || currentUser?.userType === 'user') && firstMap.routeData && (
                  <div className="mx-6 mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Map className="w-4 h-4 mr-2 text-blue-600" />
                      Comparação de Rotas
                    </h4>
                    
                    {firstMap.routeData.routes && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Rota Econômica */}
                        {firstMap.routeData.routes.economic && (
                          <div className="bg-white p-4 rounded-lg border border-green-200">
                            {/* ✅ LEGENDA CORRIGIDA */}
                            <h5 className="font-bold text-green-700 mb-3 flex items-center">
                              <span className="w-3 h-3 bg-green-500 rounded-full mr-2 flex-shrink-0"></span>
                              <span>Rota Econômica</span>
                            </h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><span className="font-medium text-gray-600">Distância:</span> <span className="font-bold">{firstMap.routeData.routes.economic.distance?.toFixed(1)} km</span></div>
                              <div><span className="font-medium text-gray-600">Duração:</span> <span className="font-bold">{Math.floor(firstMap.routeData.routes.economic.duration)}h {Math.round((firstMap.routeData.routes.economic.duration % 1) * 60)}m</span></div>
                              <div><span className="font-medium text-gray-600">Pedágios:</span> <span className="font-bold text-green-600">R$ {firstMap.routeData.routes.economic.tollData?.totalCost?.toFixed(2)}</span></div>
                              {/* ✅ NOVA INFORMAÇÃO: Combustível */}
                              {firstMap.routeData.routes.economic.fuel?.amount && (
                                <div><span className="font-medium text-gray-600">Combustível:</span> <span className="font-bold text-orange-600">{firstMap.routeData.routes.economic.fuel.amount.toFixed(1)} L</span></div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Rota Mais Curta */}
                        {firstMap.routeData.routes.shortest && (
                          <div className="bg-white p-4 rounded-lg border border-blue-200">
                            {/* ✅ LEGENDA CORRIGIDA */}
                            <h5 className="font-bold text-blue-700 mb-3 flex items-center">
                              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                              <span>Rota Mais Curta</span>
                            </h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><span className="font-medium text-gray-600">Distância:</span> <span className="font-bold">{firstMap.routeData.routes.shortest.distance?.toFixed(1)} km</span></div>
                              <div><span className="font-medium text-gray-600">Duração:</span> <span className="font-bold">{Math.floor(firstMap.routeData.routes.shortest.duration)}h {Math.round((firstMap.routeData.routes.shortest.duration % 1) * 60)}m</span></div>
                              <div><span className="font-medium text-gray-600">Pedágios:</span> <span className="font-bold text-blue-600">R$ {firstMap.routeData.routes.shortest.tollData?.totalCost?.toFixed(2)}</span></div>
                              {/* ✅ NOVA INFORMAÇÃO: Combustível */}
                              {firstMap.routeData.routes.shortest.fuel?.amount && (
                                <div><span className="font-medium text-gray-600">Combustível:</span> <span className="font-bold text-orange-600">{firstMap.routeData.routes.shortest.fuel.amount.toFixed(1)} L</span></div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Mapa Visual */}
                    <div className="h-64 rounded-lg overflow-hidden">
                      <RouteMapComponent
                        origin={firstMap.routeData.origin?.coordinates}
                        destination={firstMap.routeData.destination?.coordinates}
                        waypoints={firstMap.routeData.waypoints}
                        economicRoute={firstMap.routeData.routes?.economic}
                        shortestRoute={firstMap.routeData.routes?.shortest}
                        height="350px"
                      />
                    </div>
                  </div>
                )}

                {/* ✅ ALTERAÇÃO: Propostas Recebidas - agora ocupa largura total */}
                <div className="mx-6 mb-6 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <Percent className="w-4 h-4 mr-2 text-yellow-600" />
                    {currentUser?.userType === 'carrier' ? 'Sua Negociação' : 'Propostas Recebidas'}
                  </h4>
                  <div className="space-y-4">
                      {mapsInGroup.map((map) => (
                          <div key={map.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                              { editingProposalId === map.id ? (
                                // FORMULÁRIO DE EDIÇÃO DA PROPOSTA (INDIVIDUAL)
                                <div className="space-y-4">
                                  <h5 className="font-semibold text-gray-800">Editando Proposta para {map.selectedCarrier}</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="edit-carrier">Transportadora</Label>
                                      <Select 
                                        value={proposalEditData.selectedCarrier} 
                                        onValueChange={(value) => setProposalEditData(p => ({...p, selectedCarrier: value}))}
                                      >
                                        <SelectTrigger id="edit-carrier"><SelectValue placeholder="Selecione a transportadora"/></SelectTrigger>
                                        <SelectContent>
                                          {carriers.filter(c => c.active).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-mapValue">Valor do Mapa (R$)</Label>
                                      <Input 
                                        id="edit-mapValue" 
                                        type="number" 
                                        step="0.01"
                                        value={proposalEditData.mapValue} 
                                        onChange={(e) => setProposalEditData(p => ({...p, mapValue: e.target.value}))}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-observation">Observação (Obrigatória se houver alteração)</Label>
                                    <Textarea 
                                      id="edit-observation" 
                                      placeholder="Descreva o motivo da alteração..." 
                                      value={proposalEditData.observation} 
                                      onChange={(e) => setProposalEditData(p => ({...p, observation: e.target.value}))}
                                      rows={3}
                                      className="resize-none"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={handleCancelProposalEdit}><Ban className="w-4 h-4 mr-2"/>Cancelar</Button>
                                    <Button size="sm" onClick={() => handleSaveProposalEdit(map.id)} className="bg-blue-600 hover:bg-blue-700">
                                      <Save className="w-4 h-4 mr-2"/>Salvar Alterações
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // VISUALIZAÇÃO PADRÃO DA PROPOSTA
                                <>
                                  <div className="flex justify-between items-start">
                                    <h5 className="font-semibold text-gray-800 flex items-center mb-3">
                                        🚛 {map.selectedCarrier}
                                        {map.status === 'rejected' && <Badge variant="destructive" className="ml-2">Encerrado</Badge>}
                                        {currentUser?.userType !== 'carrier' && map.selectedCarrier === lowestCarrier && lowestCarrier && lowestValue !== Infinity && (
                                          <Badge className="ml-2 bg-green-100 text-green-800">💰 Menor Valor</Badge>
                                        )}
                                    </h5>
                                    {currentUser?.userType !== 'carrier' && map.status === 'negotiating' && (
                                      <Button variant="outline" size="sm" onClick={() => handleStartProposalEdit(map)}>
                                        <Edit className="w-4 h-4 mr-2"/> Editar
                                      </Button>
                                    )}
                                  </div>

                                  {/* Modal de Justificativa */}
                                  {showJustificationModal[map.id] && (
                                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                      <div className="flex items-center mb-3">
                                        <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                                        <h6 className="font-semibold text-orange-800">
                                          Justificativa Obrigatória
                                        </h6>
                                      </div>
                                      <p className="text-sm text-orange-700 mb-3">
                                        Você está escolhendo {map.selectedCarrier} (R$ {userCounterProposal[map.id]?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) 
                                        ao invés da menor proposta de {lowestCarrier} (R$ {lowestValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). 
                                        Por favor, justifique esta decisão:
                                      </p>
                                      <div className="space-y-3">
                                        <Textarea
                                          placeholder="Digite a justificativa..."
                                          value={justificationText[map.id] || ''}
                                          onChange={(e) => setJustificationText(prev => ({ ...prev, [map.id]: e.target.value }))}
                                          rows={3}
                                          className="resize-none"
                                        />
                                        <div className="flex gap-2">
                                          <Button 
                                            onClick={() => handleJustificationSubmit(map.id)}
                                            className="bg-orange-600 hover:bg-orange-700"
                                            disabled={!justificationText[map.id] || justificationText[map.id].trim().length < 10 || contractLoading[map.id]}
                                          >
                                            {contractLoading[map.id] ? (
                                              <>
                                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                  Confirmando...
                                              </>
                                            ) : (
                                              <>
                                                  <CheckCircle className="w-4 h-4 mr-2" />
                                                  Confirmar e Fechar Frete
                                              </>
                                            )}
                                          </Button>
                                          <Button 
                                            variant="outline" 
                                            onClick={() => cancelJustification(map.id)}
                                            disabled={contractLoading[map.id]}
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {map.routeData && (
                                    <>
                                      {/* Basic Freight Information for this specific proposal */}
                                      <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                                          <FileText className="w-4 h-4 mr-2 text-blue-600" />
                                          Informações do Frete
                                        </h5>
                                        <div className="text-sm text-gray-600 space-y-2">
                                          <p><span className="font-semibold">Origem:</span> {map.origin}</p>
                                          <p><span className="font-semibold">Destino:</span> {map.destination}</p>
                                          <p><span className="font-semibold">Peso:</span> {map.weight?.toLocaleString('pt-BR')} kg</p>
                                          <p><span className="font-semibold">Tipo:</span> {map.truckType}</p>
                                        </div>
                                      </div>

                                      {/* Route Details component */}
                                      { (currentUser.userType === 'admin' || currentUser.userType === 'user') && (
                                        <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                                          <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                                            <Route className="w-4 h-4 mr-2" />
                                            Detalhes da Rota
                                          </h4>
                                          <RouteDetails routeData={map.routeData} />
                                        </div>
                                      )}

                                      {/* ✅ NOVO: Exibir paradas do roteiro */}
                                      <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                                          <MapPin className="w-4 h-4 mr-2" />
                                          Paradas do Roteiro
                                        </h4>
                                        <RouteStopsDisplay
                                          routeData={map.routeData}
                                          currentUser={currentUser}
                                          deliveredStops={map.deliveredStops || []}
                                        />
                                      </div>
                                    </>
                                  )}

                                  {/* Visão da Transportadora */}
                                  {currentUser?.userType === 'carrier' && map.selectedCarrier === currentUser.carrierName && (
                                      map.status === 'rejected' ? (
                                          <div className="text-center p-3 bg-red-50 rounded-md">
                                              <p className="font-medium text-red-700">
                                                {map.rejectedReason || 'O cliente não seguiu com esta negociação.'}
                                              </p>
                                          </div>
                                      ) : map.carrierProposals?.[currentUser.carrierName] ? (
                                          <div className="p-3 bg-green-50 rounded-md">
                                              <p className="text-sm text-gray-600">Proposta enviada:</p>
                                              <p className="text-lg font-bold text-green-600">R$ {map.carrierProposals[currentUser.carrierName].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                          </div>
                                      ) : (
                                          <div className="flex gap-2 items-center">
                                              <Input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="Sua proposta (R$)" 
                                                value={carrierProposalInput[map.id] || ''}
                                                onChange={(e) => {
                                                  if (e.target.value.length > 9) return; 
                                                  setCarrierProposalInput(prev => ({...prev, [map.id]: e.target.value}))
                                                }} 
                                                disabled={contractLoading[map.id]}
                                              />
                                              <Button 
                                                onClick={() => handleCarrierProposalSubmit(map.id)}
                                                disabled={!carrierProposalInput[map.id] || contractLoading[map.id]}
                                              >
                                                {contractLoading[map.id] ? (
                                                  <>
                                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                      Enviando...
                                                  </>
                                                ) : (
                                                  <>
                                                      <Send className="w-4 h-4 mr-2" /> Enviar
                                                  </>
                                                )}
                                              </Button>
                                          </div>
                                      )
                                  )}

                                  {/* Visão do Admin/Usuário */}
                                  {currentUser?.userType !== 'carrier' && map.status === 'negotiating' && !showJustificationModal[map.id] && (
                                      <div className="bg-green-50 rounded-lg p-4 border border-green-200 mt-4">
                                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                              Ações da Negociação
                                          </h4>
                                          {map.carrierProposals?.[map.selectedCarrier] ? (
                                              <div className="space-y-4">
                                                  <div className="grid md:grid-cols-2 gap-4 items-center">
                                                      <div className="p-3 border rounded-lg">
                                                          <p className="text-sm text-gray-600">Proposta de {map.selectedCarrier}</p>
                                                          <p className="text-lg font-bold text-green-600">R$ {map.carrierProposals[map.selectedCarrier].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                          <p className="text-xs text-blue-600 font-medium mt-1">
                                                            {((map.carrierProposals[map.selectedCarrier] / firstMap.mapValue) * 100).toFixed(1)}% do valor do mapa
                                                          </p>
                                                      </div>
                                                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                                          <label className="block text-sm font-medium text-gray-700 mb-2">Definir valor final e fechar frete:</label>
                                                          <div className="flex gap-2 items-center">
                                                              <Input 
                                                                type="number" 
                                                                step="0.01" 
                                                                placeholder="Valor final (R$)" 
                                                                value={userCounterProposal[map.id] || ''}
                                                                onChange={(e) => {
                                                                  if (e.target.value.length > 9) return; 
                                                                  setUserCounterProposal(prev => ({...prev, [map.id]: e.target.value}))
                                                                }} 
                                                                disabled={contractLoading[map.id]}
                                                              />
                                                              <Button 
                                                                onClick={() => handleUserCounterProposalAndFinalize(map.id)} 
                                                                disabled={!userCounterProposal[map.id] || contractLoading[map.id]} 
                                                                className="bg-green-600 hover:bg-green-700"
                                                              >
                                                                {contractLoading[map.id] ? (
                                                                  <>
                                                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                      Fechando...
                                                                  </>
                                                                ) : (
                                                                  <>
                                                                      <CheckCircle className="w-4 h-4 mr-2" />Fechar
                                                                  </>
                                                                )}
                                                              </Button>
                                                              <Button 
                                                                onClick={() => handleRejectFreight(map.id)} 
                                                                variant="outline" 
                                                                size="icon" 
                                                                className="text-red-500 hover:bg-red-50"
                                                                disabled={contractLoading[map.id]}
                                                              >
                                                                {contractLoading[map.id] ? (
                                                                  <>
                                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                                  </>
                                                                ) : (
                                                                  <XCircle className="w-5 h-5" />
                                                                )}
                                                              </Button>
                                                          </div>
                                                      </div>
                                                  </div>
                                                  
                                                  {/* NOVO: Campo de observação para finalização */}
                                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                                          Observações da finalização (opcional):
                                                      </label>
                                                      <Textarea
                                                          placeholder="Digite observações sobre a finalização deste frete..."
                                                          value={finalizationObservation[map.id] || ''}
                                                          onChange={(e) => setFinalizationObservation(prev => ({ ...prev, [map.id]: e.target.value }))}
                                                          rows={2}
                                                          className="resize-none"
                                                          disabled={contractLoading[map.id]}
                                                      />
                                                  </div>
                                              </div>
                                          ) : (
                                              <div className="text-center p-3 bg-gray-100 rounded-md">
                                                  <p className="text-gray-500">Aguardando proposta de {map.selectedCarrier}...</p>
                                              </div>
                                          )}
                                      </div>
                                  )}
                                </>
                              )}
                          </div>
                      ))}
                  </div>
                </div>
                </CardContent>
                )}
                
                <CardFooter className="bg-gray-50 p-3 flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => toggleDetails(mapNumber)} className="text-blue-600 hover:text-blue-700">
                    {isDetailsExpanded ? 'Ocultar' : 'Ver'} Detalhes da Rota
                    {isDetailsExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                  </Button>
                </CardFooter>

                {isDetailsExpanded && (
                  <div className="border-t bg-white p-4 md:p-6 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div><p className="text-xs text-gray-500">Distância</p><p className="font-medium">{firstMap.totalKm} km</p></div>
                          <div><p className="text-xs text-gray-500">Tipo Caminhão</p><p className="font-medium">{firstMap.truckType}</p></div>
                          <div><p className="text-xs text-gray-500">Data Carregamento</p><p className="font-medium">{firstMap.loadingDate ? format(parseISO(firstMap.loadingDate), "dd/MM/yyyy") : 'N/A'}</p></div>
                      </div>
                      
                      {/* Exibição do histórico de edições */}
                      {firstMap.editObservations && firstMap.editObservations.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1 mt-4">Histórico de Edições</p>
                          <div className="space-y-2">
                            {firstMap.editObservations.slice().reverse().map((obs, i) => (
                              <div key={i} className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <p className="font-semibold">{obs.details}</p>
                                <p className="italic text-gray-700">"{obs.observation}"</p>
                                <p className="text-xs text-gray-500 mt-1"> - {obs.user} em {formatToBrazilTime(obs.timestamp)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </Card>
              );
            })}
          </div>

          {/* CONTROLES DE PAGINAÇÃO */}
          {paginationData.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!paginationData.hasPrevPage}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show current page, 2 pages before, and 2 pages after for pagination controls
                    if (paginationData.totalPages <= 5) return true; // Show all if 5 or less
                    return Math.abs(page - currentPage) <= 2;
                  })
                  .map(page => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={page === currentPage ? "bg-blue-600 text-white" : ""}
                    >
                      {page}
                    </Button>
                  ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!paginationData.hasNextPage}
                className="flex items-center gap-1"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de Preview da Imagem (for map image click) */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Visualizar Imagem</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center h-full">
              <img
                src={selectedImage}
                alt="Visualização da Imagem"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedImage(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {/* Modal de Edição Completa do Mapa */}
      {editingMapId && (
          <Dialog open={!!editingMapId} onOpenChange={closeEditMapModal}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                      <DialogTitle>Editar Mapa - {editFormData.mapNumber}</DialogTitle>
                  </DialogHeader>
                  {editFormData && Object.keys(editFormData).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        {/* Identificação */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Identificação do Mapa</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="edit-mapNumber">Número do Mapa</Label>
                              <Input
                                id="edit-mapNumber"
                                value={editFormData.mapNumber || ''}
                                onChange={(e) => handleEditMapDataChange('mapNumber', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-loadingMode">Modalidade</Label>
                              <Select value={editFormData.loadingMode} onValueChange={(value) => handleEditMapDataChange('loadingMode', value)}>
                                <SelectTrigger id="edit-loadingMode">
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

                        {/* Imagem do Mapa */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Imagem do Mapa</h5>
                          {!editFormData.mapImage ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                                  className="pointer-events-none"
                                >
                                  {uploadingImage ? (
                                    <>
                                      <Loader2 className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></Loader2>
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Escolher Imagem
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <img
                                src={editFormData.mapImage}
                                alt="Mapa da Rota"
                                className="w-full h-48 object-contain rounded border"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setShowImagePreview(true)}
                                  variant="outline"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={removeEditImage}
                                  className="text-red-600"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Remover
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Rota */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Informações da Rota</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="edit-origin">Origem</Label>
                              <Input
                                id="edit-origin"
                                value={editFormData.origin || ''}
                                onChange={(e) => handleEditMapDataChange('origin', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-destination">Destino</Label>
                              <Input
                                id="edit-destination"
                                value={editFormData.destination || ''}
                                onChange={(e) => handleEditMapDataChange('destination', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-totalKm">Distância (km)</Label>
                              <Input
                                id="edit-totalKm"
                                type="number"
                                value={editFormData.totalKm || ''}
                                onChange={(e) => handleEditMapDataChange('totalKm', parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Carga e Valores */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Carga e Valores</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="edit-weight">Peso (kg)</Label>
                              <Input
                                id="edit-weight"
                                type="number"
                                step="0.01"
                                value={editFormData.weight || ''}
                                onChange={(e) => {
                                  if (e.target.value.length > 9) return;
                                  handleEditMapDataChange('weight', parseFloat(e.target.value) || 0)
                                }}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-mapValue">Valor do Frete (R$)</Label>
                              <Input
                                id="edit-mapValue"
                                type="number"
                                step="0.01"
                                value={editFormData.mapValue || ''}
                                onChange={(e) => {
                                  if (e.target.value.length > 9) return;
                                  handleEditMapDataChange('mapValue', parseFloat(e.target.value) || 0)
                                }}
                                className="font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Transporte */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Informações de Transporte</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <Label htmlFor="edit-truckType">Tipo de Caminhão</Label>
                              <Select value={editFormData.truckType} onValueChange={(value) => handleEditMapDataChange('truckType', value)}>
                                <SelectTrigger id="edit-truckType">
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getFilteredTruckTypes(editFormData.loadingMode).map(truck => (
                                    <SelectItem key={truck.id} value={truck.name}>
                                      {truck.name} ({truck.capacity}t)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="edit-loadingDate">Data de Carregamento</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start">
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    {editFormData.loadingDate ? format(editFormData.loadingDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={editFormData.loadingDate}
                                    onSelect={(date) => handleEditMapDataChange('loadingDate', date)}
                                    locale={ptBR}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>

                        {/* Transportadoras */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <Label>Transportadoras* (Selecione uma ou mais)</Label>
                          <div className="border rounded-lg p-4 mt-2 bg-white max-h-48 overflow-y-auto border-gray-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {carriers
                                .filter(carrier => carrier.active)
                                .map((carrier) => (
                                  <div key={carrier.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded">
                                    <input
                                      type="checkbox"
                                      id={`edit-carrier-${carrier.id}`}
                                      checked={(editFormData.selectedCarriers || []).includes(carrier.name)}
                                      onChange={() => handleCarrierToggleInEdit(carrier.name)}
                                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <label
                                      htmlFor={`edit-carrier-${carrier.id}`}
                                      className="text-sm font-medium cursor-pointer flex-1"
                                    >
                                      {carrier.name}
                                    </label>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Observações */}
                        <div className="md:col-span-2 bg-white rounded-lg p-4 border border-gray-200">
                          <h5 className="font-medium text-gray-800 mb-3">Observações da Rota</h5>
                          <Textarea
                            placeholder="Informações adicionais sobre a rota..."
                            value={editFormData.routeInfo || ''}
                            onChange={(e) => handleEditMapDataChange('routeInfo', e.target.value)}
                            rows={3}
                          />
                        </div>

                        {/* Observação da Edição */}
                        <div className="md:col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <Label htmlFor="edit-observation">Observação da Edição *</Label>
                          <p className="text-sm text-orange-700 mb-2">Obrigatória para salvar as alterações do mapa.</p>
                          <Textarea
                            id="edit-observation"
                            placeholder="Descreva o motivo das alterações..."
                            value={editObservation}
                            onChange={(e) => setEditObservation(e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                  ) : <p>Carregando dados...</p>}
                  <DialogFooter className="pt-4">
                      <Button variant="outline" onClick={closeEditMapModal}><Ban className="w-4 h-4 mr-2" />Cancelar</Button>
                      <Button onClick={handleEditMapSubmit} disabled={contractLoading.mapEdit} className="bg-blue-600 hover:bg-blue-700">
                          {contractLoading.mapEdit ? (
                              <>
                                  <Loader2 className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></Loader2>
                                  Salvando...
                              </>
                          ) : (
                              <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Salvar Alterações
                              </>
                          )}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      )}
    </div>
  );
}
