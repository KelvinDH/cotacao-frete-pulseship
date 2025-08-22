
import React, { useState, useEffect } from 'react';
import { FreightMap, User, UploadFile } from '@/components/ApiDatabase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Truck, MapPin, Calendar, Weight, Package, Clock, CheckCircle, AlertTriangle, Phone, User as UserIcon, Route, Loader2, Camera, FileText, Upload, Eye, X, Plus, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RouteMapComponent from '../components/RouteMapComponent';
import TrackingTimeline from '../components/TrackingTimeline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Helper function for ISO time with Brazil timezone consideration.
// This was commented out in the original file, but is used by the logic.
// A simple implementation is provided to ensure functionality.
const getBrazilIsoNow = () => {
  // In a real application, you'd integrate a proper timezone library
  // or ensure your server handles timezones correctly.
  // For demonstration, this returns current UTC time as ISO string.
  return new Date().toISOString(); 
};

// ✅ NOVO: Função "tradutora" para extrair as paradas de qualquer formato de routeData
const extractAllStops = (routeData) => {
  if (!routeData) return [];

  // Prioridade 1: O formato mais completo
  if (routeData.fractionalRoutes && routeData.fractionalRoutes.length > 0) {
    return routeData.fractionalRoutes;
  }

  // Prioridade 2: Formato antigo (baseado em waypoints e destination)
  // Assume waypoints have a 'name' like "Parada X: Cidade/UF" or "Cidade/UF"
  let stops = [];
  if (routeData.waypoints && Array.isArray(routeData.waypoints)) {
    stops = routeData.waypoints.map(waypoint => {
      const name = waypoint.name || '';
      const cleanName = name.replace(/^(Parada \d+: )/, ''); // Remove "Parada X: " prefix
      const [city, state] = cleanName.split('/');
      return {
        destination: {
          city: city ? city.trim() : 'N/A',
          state: state ? state.trim() : 'N/A'
        }
      };
    });
  }
  // Add final destination if it's not already covered by waypoints and exists
  if (routeData.destination && routeData.destination.name) {
    const destName = routeData.destination.name || '';
    const cleanDestName = destName.replace('Destino: ', '');
    const [city, state] = cleanDestName.split('/');
    if (city && !stops.some(s => s.destination.city === city.trim())) {
      stops.push({
        destination: { city: city.trim(), state: state?.trim() || 'N/A' }
      });
    }
  }
  return stops;
};

// ✅ COMPONENTE CORRIGIDO: RouteStopsDisplay - lógica de avanço após falha
const RouteStopsDisplay = ({ freight, currentUser, deliveredStops, failedStops, handleUpdateStatus, loadingMapId, setLoadingMapId, handleInitialStatusUpdate, loadFreights }) => {
  const allStops = extractAllStops(freight.routeData);

  if (!allStops || allStops.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Nenhum detalhe de rota disponível para o progresso de entrega.
      </div>
    );
  }

  const currentStatus = freight.trackingStatus || 'waiting';
  let localButtonText = '';
  let localButtonAction = null;
  let localIsFinished = false;

  // ✅ CORREÇÃO: Considerar AMBOS os arrays (entregues E falhados) para determinar progresso
  const cleanedDeliveredCities = (deliveredStops || []).map(ds => {
    if (typeof ds === 'string') {
      const parts = ds.split(':');
      if (parts.length > 1) return parts[1].split('/')[0].trim();
      return ds.split('/')[0].trim();
    }
    return '';
  }).filter(s => s !== '');

  const cleanedFailedCities = (failedStops || []).map(fs => {
    if (typeof fs === 'string') {
      const parts = fs.split(':');
      if (parts.length > 1) return parts[1].split('/')[0].trim();
      return fs.split('/')[0].trim();
    }
    return '';
  }).filter(s => s !== '');
  
  // ✅ CHAVE DA CORREÇÃO: Todas as cidades que foram "resolvidas" (entregues OU falhadas)
  const allResolvedCities = [...new Set([...cleanedDeliveredCities, ...cleanedFailedCities])];

  // Lógica de status para o botão de ação principal
  if (currentStatus === 'in_transit') {
    const allStopsCities = allStops.map(stopObj => stopObj.destination.city.trim());
    
    // ✅ CORREÇÃO: Verificar se todas as paradas foram resolvidas (não apenas entregues)
    const allStopsResolved = allStopsCities.every(city => allResolvedCities.includes(city));

    if (!allStopsResolved) {
      // ✅ CORREÇÃO: Encontrar a próxima parada que NÃO foi resolvida (nem entregue nem falhada)
      const nextStopToDeliver = allStops.find(stopObj => {
        const stopCity = stopObj.destination.city.trim();
        return !allResolvedCities.includes(stopCity);
      });

      if (nextStopToDeliver) {
        const remainingStops = allStopsCities.filter(city => !allResolvedCities.includes(city)).length;
        localButtonText = remainingStops === 1 ? 'Finalizar Última Entrega' : `Concluir Entrega em ${nextStopToDeliver.destination.city}`;
        localButtonAction = () => handleUpdateStatus(freight, nextStopToDeliver.destination);
      } else {
        // This case should ideally not be reached if allStopsResolved is false
        // If it is reached, it implies an inconsistency, so disable the button for safety
        localButtonText = 'Erro: Nenhuma parada pendente encontrada';
        localIsFinished = true;
      }
    } else {
      localButtonText = 'Todas as Paradas Concluídas';
      localButtonAction = async () => {
        setLoadingMapId(freight.id);
        await FreightMap.update(freight.id, { trackingStatus: 'delivered' });
        await loadFreights();
      };
    }
  } else if (currentStatus === 'loading') {
    const firstStop = allStops[0]?.destination;
    localButtonText = `Iniciar Viagem para ${firstStop?.city || 'o primeiro destino'}`;
    localButtonAction = () => handleInitialStatusUpdate(freight, 'in_transit');
  } else if (currentStatus === 'waiting') {
    localButtonText = 'Iniciar Carregamento';
    localButtonAction = () => handleInitialStatusUpdate(freight, 'loading');
  } else if (currentStatus === 'delivered') {
    localButtonText = 'Frete Finalizado';
    localIsFinished = true;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-800 text-sm">Roteiro Detalhado:</h4>
      <div className="space-y-3">
        {allStops.map((stopObj, index) => {
          const stopCity = stopObj.destination.city.trim();
          
          // ✅ CORREÇÃO: Status visual baseado em AMBOS os arrays
          const isDelivered = cleanedDeliveredCities.includes(stopCity);
          const isFailed = cleanedFailedCities.includes(stopCity);
          
          let statusIcon, statusText, statusColor;
          if (isDelivered) {
            statusIcon = <CheckCircle className="w-4 h-4" />;
            statusText = 'Entregue';
            statusColor = 'text-green-600 bg-green-50 border-green-200';
          } else if (isFailed) {
            statusIcon = <XCircle className="w-4 h-4" />;
            statusText = 'Não Entregue';
            statusColor = 'text-red-600 bg-red-50 border-red-200';
          } else {
            statusIcon = <Clock className="w-4 h-4" />;
            statusText = 'Pendente';
            statusColor = 'text-gray-600 bg-gray-50 border-gray-200';
          }

          return (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${statusColor}`}>
              <div className="flex items-center space-x-3">
                {statusIcon}
                <div>
                  <p className="font-medium text-sm">
                    {index + 1}. {stopObj.destination.city}/{stopObj.destination.state}
                  </p>
                  {stopObj.data && (
                    <p className="text-xs text-gray-500">
                      Distância: {stopObj.data.distance?.toFixed(1) || 'N/A'} km
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={statusColor}>
                {statusText}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Botão de ação principal */}
      {currentUser && currentUser.userType === 'driver' && !localIsFinished && (
        <Button
          onClick={localButtonAction}
          disabled={loadingMapId === freight.id || !localButtonAction}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loadingMapId === freight.id ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            localButtonText
          )}
        </Button>
      )}
    </div>
  );
};


export default function MeusFretesPage() {
  const [assignedFreights, setAssignedFreights] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // Changed to true
  const [error, setError] = useState(''); // New state
  const [expandedFreight, setExpandedFreight] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Estados para ocorrências
  const [newOccurrence, setNewOccurrence] = useState('');
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(null);
  // NEW STATES
  const [loadingMapId, setLoadingMapId] = useState(null); // To disable specific freight buttons during update
  const [successMessage, setSuccessMessage] = useState(''); // For success notifications
  // ✅ NOVOS ESTADOS: Para modal de imagem
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImagePreview, setCurrentImagePreview] = useState('');
  
  // ✅ NOVOS ESTADOS: Para o modal de confirmação de entrega
  const [showDeliveryConfirmModal, setShowDeliveryConfirmModal] = useState(false);
  const [pendingDelivery, setPendingDelivery] = useState(null); // { freight, stopToDeliver }
  const [showNotDeliveredForm, setShowNotDeliveredForm] = useState(false);
  const [notDeliveredReason, setNotDeliveredReason] = useState('');


  useEffect(() => {
    loadFreights();
  }, []);

  const loadFreights = async () => { 
    setLoading(true);
    setError(''); // Clear previous errors
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      if (user && user.userType === 'driver') {
        const allFreights = await FreightMap.list('-created_date');
        // ✅ LOG: Vamos verificar os dados brutos que chegam da API
        console.log('[MeusFretes] Fretes carregados da API:', allFreights);

        let myFreights = [];

        if (user.cpf) {
          const freightsByCpf = allFreights.filter(freight => 
            freight.assignedDriver === user.cpf
          );
          myFreights = [...myFreights, ...freightsByCpf];
        }

        if (user.assignedMapNumber) {
          const freightsByMapNumber = allFreights.filter(freight => 
            freight.mapNumber === user.assignedMapNumber && 
            !myFreights.find(f => f.id === freight.id)
          );
          myFreights = [...myFreights, ...freightsByMapNumber];
        }

        const processedFreights = myFreights.map(freight => ({
          ...freight,
          trackingHistory: freight.trackingHistory ? 
            (typeof freight.trackingHistory === 'string' ? JSON.parse(freight.trackingHistory) : freight.trackingHistory) : [],
          occurrences: freight.occurrences ? 
            (typeof freight.occurrences === 'string' ? JSON.parse(freight.occurrences) : freight.occurrences) : [],
          occurrenceImages: freight.occurrenceImages ? 
            (typeof freight.occurrenceImages === 'string' ? JSON.parse(freight.occurrenceImages) : freight.occurrenceImages) : [],
          deliveredStops: freight.deliveredStops ?
            (typeof freight.deliveredStops === 'string' ? JSON.parse(freight.deliveredStops) : freight.deliveredStops) : [],
          failedStops: freight.failedStops ? // ✅ New: Parse failedStops
            (typeof freight.failedStops === 'string' ? JSON.parse(freight.failedStops) : freight.failedStops) : [],
        }));
        
        setAssignedFreights(processedFreights);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar seus fretes. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Handles general status updates like waiting -> loading, loading -> in_transit
  // Renamed from handleUpdateGeneralFreightStatus to handleInitialStatusUpdate
  const handleInitialStatusUpdate = async (freight, newStatus) => {
    if (!currentUser) return;
    setLoadingMapId(freight.id);
    const now = getBrazilIsoNow();

    try {
      let updateData = { trackingStatus: newStatus };
      let historyMessage = '';

      switch (newStatus) {
        case 'loading':
          historyMessage = 'Carregamento iniciado.'; // Adjusted message
          break;
        case 'in_transit':
          // ✅ ALTERAÇÃO: Mensagem inicial aponta para o primeiro destino usando extractAllStops
          const allStops = extractAllStops(freight.routeData);
          const firstStop = allStops[0]?.destination;
          if (firstStop) {
            historyMessage = `Em trânsito para ${firstStop.city}/${firstStop.state}.`;
          } else {
            historyMessage = 'Viagem iniciada.';
          }
          break;
        case 'delivered': // Added case for final delivery from main button
          historyMessage = 'Frete finalizado. Todas as entregas concluídas.';
          break;
        default:
          historyMessage = `Status alterado para: ${getStatusLabel(newStatus)}.`;
      }

      const currentTrackingHistory = freight.trackingHistory || [];
      const newHistoryEntry = {
        status: newStatus,
        message: historyMessage,
        timestamp: now,
        driverCpf: currentUser.cpf,
        driverName: currentUser.fullName
      };
      const updatedHistory = [...currentTrackingHistory, newHistoryEntry];
      updateData.trackingHistory = JSON.stringify(updatedHistory);

      await FreightMap.update(freight.id, updateData);
      
      await loadFreights(); // ✅ SOLUÇÃO DEFINITIVA: Recarrega todos os fretes para garantir 100% de consistência

      setSuccessMessage(`Status atualizado para: ${getStatusLabel(newStatus)}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    } finally {
      setLoadingMapId(null);
    }
  };

  // ✅ FUNÇÃO MODIFICADA: Agora abre modal ao invés de atualizar direto
  const handleUpdateStatus = async (map, stopToDeliver) => { // 'stopToDeliver' is now the {city, state} object
    setPendingDelivery({ freight: map, stopToDeliver });
    setShowDeliveryConfirmModal(true);
    setShowNotDeliveredForm(false); // Reset form visibility
    setNotDeliveredReason(''); // Clear previous reason
  };

  // ✅ FUNÇÃO CORRIGIDA: Atualiza o servidor e DEPOIS recarrega os dados
  const handleConfirmDelivery = async () => {
    if (!pendingDelivery || !currentUser) return;
    const { freight, stopToDeliver } = pendingDelivery;
    setLoadingMapId(freight.id);
    const now = getBrazilIsoNow();

    try {
        const allStops = extractAllStops(freight.routeData); // Use the new helper
        const currentDeliveredStops = Array.isArray(freight.deliveredStops) ? freight.deliveredStops : [];
        
        // CORREÇÃO: Padroniza o array de entregas para conter apenas o nome da cidade para comparação.
        const cleanedDeliveredCities = currentDeliveredStops.map(s => {
          if (typeof s === 'string') {
            const parts = s.split(':'); // Handles "Reason: City/UF"
            if (parts.length > 1) return parts[1].split('/')[0].trim();
            return s.split('/')[0].trim(); // Handles "City/UF" or just "City"
          }
          return '';
        }).filter(s => s !== '');
        
        const stopCityClean = stopToDeliver.city.trim();
        
        // Check if the city of the stop to deliver is already in the cleaned delivered stops list
        if (cleanedDeliveredCities.includes(stopCityClean)) { 
            alert('Esta entrega já foi marcada como concluída.');
            setLoadingMapId(null);
            setShowDeliveryConfirmModal(false);
            setPendingDelivery(null);
            return;
        }

        // Store the delivered stop in 'City/State' format
        const newDeliveredStops = [...currentDeliveredStops, `${stopToDeliver.city}/${stopToDeliver.state}`];

        // Also check if it was previously marked as failed, if so, remove it from failedStops
        const currentFailedStops = Array.isArray(freight.failedStops) ? freight.failedStops : [];
        // Filter out any failed stop that matches the current delivered city (considering format "Reason: City/UF")
        const updatedFailedStops = currentFailedStops.filter(failedStr => {
          if (typeof failedStr === 'string') {
            const parts = failedStr.split(':');
            const failedCity = (parts.length > 1 ? parts[1] : failedStr).split('/')[0].trim();
            return failedCity !== stopCityClean;
          }
          return true; // Keep if not a string
        });

        const deliveredCount = newDeliveredStops.length;
        const failedCount = updatedFailedStops.length;
        const totalStops = allStops.length;

        let newTrackingStatus = freight.trackingStatus;
        const newHistoryEntries = [];
    
        // First, add the entry for the just completed delivery.
        // ✅ ALTERAÇÃO: Adds a descriptive message for the completed delivery
        // ✅ CORREÇÃO: Saves data in the correct format (technical status + descriptive message)
        newHistoryEntries.push({
          status: 'in_transit', // Technical status
          message: `Entrega em ${stopToDeliver.city}/${stopToDeliver.state} foi concluída.`, // Descriptive message
          timestamp: now,
          driverCpf: currentUser.cpf,
          driverName: currentUser.fullName
        });
    
        if (deliveredCount + failedCount >= totalStops) { // All stops are now resolved (delivered or failed)
            // If it was the last delivery
            newTrackingStatus = 'delivered'; // The main status changes to delivered
            // ✅ ALTERAÇÃO: Adds a descriptive message for the end of the freight
            newHistoryEntries.push({
                status: newTrackingStatus, // Technical status
                message: 'Frete finalizado. Todos os destinos foram atendidos.', // Descriptive message
                timestamp: now,
                driverCpf: currentUser.cpf,
                driverName: currentUser.fullName
            });
        } else {
            // If there are still pending deliveries, set the status for the next destination.
            newTrackingStatus = 'in_transit'; // Still in transit, not yet fully delivered
            // Find the next pending stop (object) based on its city
            const resolvedCitiesForNextStopCheck = [...newDeliveredStops.map(s => (s.split('/')[0].trim())), ...updatedFailedStops.map(fs => {
              const parts = fs.split(':');
              return (parts.length > 1 ? parts[1] : fs).split('/')[0].trim();
            })];
            
            const nextStopToProcess = allStops.find(stop => {
              const stopCity = stop.destination.city.trim();
              return !resolvedCitiesForNextStopCheck.includes(stopCity);
            });
            
            if (nextStopToProcess) {
                // ✅ ALTERAÇÃO: Adds a message indicating the next destination
                newHistoryEntries.push({
                    status: newTrackingStatus, // Technical status
                    message: `Em trânsito para ${nextStopToProcess.destination.city}/${nextStopToProcess.destination.state}.`, // Descriptive message
                    timestamp: now,
                    driverCpf: currentUser.cpf,
                    driverName: currentUser.fullName
                });
            }
        }
        
        const updatedHistory = [...(freight.trackingHistory || []), ...newHistoryEntries];
        
        const updates = {
            deliveredStops: JSON.stringify(newDeliveredStops),
            failedStops: JSON.stringify(updatedFailedStops), // Update failed stops
            trackingStatus: newTrackingStatus,
            trackingHistory: JSON.stringify(updatedHistory),
        };
    
        await FreightMap.update(freight.id, updates);

        await loadFreights(); // ✅ SOLUÇÃO DEFINITIVA: Recarrega todos os fretes para garantir 100% de consistência

        setSuccessMessage('Entrega concluída com sucesso!');
        setTimeout(() => setSuccessMessage(''), 3000);
    
    } catch (error) {
        console.error("Erro ao confirmar entrega:", error);
        alert(`Erro ao confirmar entrega: ${error.message}`);
    } finally {
        setLoadingMapId(null);
        setShowDeliveryConfirmModal(false);
        setPendingDelivery(null);
        setShowNotDeliveredForm(false);
        setNotDeliveredReason('');
    }
  };

  // ✅ NOVA FUNÇÃO: Abre formulário para justificar não entrega (Botão NÃO)
  const handleShowNotDeliveredForm = () => {
    setShowNotDeliveredForm(true);
  };

  // ✅ FUNÇÃO CORRIGIDA: Atualiza o servidor e DEPOIS recarrega os dados
  const handleSaveNotDelivered = async () => { // Changed from handleConfirmNotDelivered in outline to match existing function name
    if (!notDeliveredReason.trim()) {
      alert('Por favor, informe o motivo da não entrega.');
      return;
    }
    
    if (!pendingDelivery || !currentUser) return;
    const { freight, stopToDeliver } = pendingDelivery;
    setLoadingMapId(freight.id);
    const now = getBrazilIsoNow();

    try {
        const allStops = extractAllStops(freight.routeData);
        const newHistoryEntries = [];
        
        // ✅ LÓGICA ATUALIZADA: Registra a falha no novo campo com motivo
        const currentFailedStops = Array.isArray(freight.failedStops) ? freight.failedStops : [];
        const newFailedStops = [...currentFailedStops, `${notDeliveredReason.trim()}: ${stopToDeliver.city}/${stopToDeliver.state}`];

        // Also ensure it's not in deliveredStops if, for some reason, it was marked there
        const currentDeliveredStops = Array.isArray(freight.deliveredStops) ? freight.deliveredStops : [];
        // Filter out any delivered stop that matches the current failed city (considering format "City/UF")
        const updatedDeliveredStops = currentDeliveredStops.filter(deliveredStr => {
          if (typeof deliveredStr === 'string') {
            const deliveredCity = deliveredStr.split('/')[0].trim();
            return deliveredCity !== stopToDeliver.city.trim();
          }
          return true; // Keep if not a string
        });

        // Registra a entrega não realizada
        newHistoryEntries.push({
          status: 'delivery_not_completed',
          message: `Entrega em ${stopToDeliver.city}/${stopToDeliver.state} não foi realizada. Motivo: ${notDeliveredReason.trim()}.`,
          timestamp: now,
          driverCpf: currentUser.cpf,
          driverName: currentUser.fullName
        });

        const deliveredCount = updatedDeliveredStops.length;
        const failedCount = newFailedStops.length;
        const totalStops = allStops.length;

        let newTrackingStatus = freight.trackingStatus; // Keep current status initially

        if (deliveredCount + failedCount >= totalStops) {
            // Não há mais paradas pendentes (todas entregues ou falhas), finaliza o frete
            newTrackingStatus = 'delivered';
            newHistoryEntries.push({
                status: 'delivered',
                message: 'Frete finalizado com todas as paradas resolvidas (entregues ou não).',
                timestamp: now,
                driverCpf: currentUser.cpf,
                driverName: currentUser.fullName
            });
        } else {
            // Ainda há paradas, segue para a próxima
            newTrackingStatus = 'in_transit';
            // Use the combined list of resolved cities for next stop check
            const allResolvedCitiesForNextStopCheck = [
              ...updatedDeliveredStops.map(s => (s.split('/')[0].trim())), 
              ...newFailedStops.map(fs => {
                const parts = fs.split(':');
                return (parts.length > 1 ? parts[1] : fs).split('/')[0].trim();
              })
            ];

            const nextStopToProcess = allStops.find(stop => {
              const stopCity = stop.destination.city.trim();
              return !allResolvedCitiesForNextStopCheck.includes(stopCity);
            });
            
            if (nextStopToProcess) {
              newHistoryEntries.push({
                  status: 'in_transit',
                  message: `Seguindo viagem para ${nextStopToProcess.destination.city}/${nextStopToProcess.destination.state}.`,
                  timestamp: now,
                  driverCpf: currentUser.cpf,
                  driverName: currentUser.fullName
              });
            }
        }
        
        const updatedHistory = [...(freight.trackingHistory || []), ...newHistoryEntries];
        
        const updates = {
            failedStops: JSON.stringify(newFailedStops), // Salva o novo campo
            deliveredStops: JSON.stringify(updatedDeliveredStops), // Update delivered stops (in case it was there)
            trackingStatus: newTrackingStatus,
            trackingHistory: JSON.stringify(updatedHistory),
        };

        await FreightMap.update(freight.id, updates);
        
        await loadFreights(); // ✅ SOLUÇÃO DEFINITIVA: Recarrega todos os fretes para garantir 100% de consistência

        setSuccessMessage('Status atualizado. Seguindo viagem.');
        setTimeout(() => setSuccessMessage(''), 3000);
        
    } catch (error) {
        console.error('Erro ao registrar não entrega:', error);
        alert('Erro ao salvar. Tente novamente.');
    } finally {
        setLoadingMapId(null);
        setShowDeliveryConfirmModal(false);
        setPendingDelivery(null);
        setShowNotDeliveredForm(false);
        setNotDeliveredReason('');
    }
  };
  
  const addOccurrence = async (freightId) => {
    if (!newOccurrence.trim()) {
      alert('Por favor, descreva a ocorrência.');
      return;
    }

    try {
      const freight = assignedFreights.find(f => f.id === freightId);
      const newOccurrenceData = {
        id: Date.now(),
        description: newOccurrence.trim(),
        timestamp: new Date().toISOString(),
        driverCpf: currentUser.cpf,
        driverName: currentUser.fullName
      };

      const updatedOccurrences = [...freight.occurrences, newOccurrenceData];

      await FreightMap.update(freightId, {
        occurrences: JSON.stringify(updatedOccurrences)
      });

      await loadFreights(); // Recarrega para garantir consistência após adicionar ocorrência

      setNewOccurrence('');
      setShowOccurrenceForm(null);
      alert('Ocorrência registrada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar ocorrência:', error);
      alert('Erro ao registrar ocorrência. Tente novamente.');
    }
  };

  const handleImageUpload = async (event, freightId) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await UploadFile({ file });
      
      const freight = assignedFreights.find(f => f.id === freightId);
      const newImageData = {
        id: Date.now(),
        url: file_url,
        name: file.name,
        timestamp: new Date().toISOString(),
        driverCpf: currentUser.cpf,
        driverName: currentUser.fullName
      };

      const updatedImages = [...freight.occurrenceImages, newImageData];

      await FreightMap.update(freightId, {
        occurrenceImages: JSON.stringify(updatedImages)
      });

      await loadFreights(); // Recarrega para garantir consistência após upload de imagem

      alert('Imagem anexada com sucesso!');
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploadingImage(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      waiting: 'Aguardando',
      loading: 'Carregando',
      in_transit: 'Em Trânsito',
      delivered: 'Entregue',
      delivery_not_completed: 'Entrega Não Concluída' // Added for history display
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      waiting: 'bg-yellow-100 text-yellow-800',
      loading: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      delivery_not_completed: 'bg-red-100 text-red-800' // Added for history display
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // ✅ NEW: getStatusBadge function as per outline
  const getStatusBadge = (status) => {
    const badges = {
      waiting: { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800' },
      loading: { label: 'Carregando', color: 'bg-blue-100 text-blue-800' },
      in_transit: { label: 'Em Trânsito', color: 'bg-purple-100 text-purple-800' },
      delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
      delivery_not_completed: { label: 'Entrega Não Concluída', color: 'bg-red-100 text-red-800' } // Added badge for history
    };
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  const toggleExpanded = (freightId) => {
    setExpandedFreight(expandedFreight === freightId ? null : freightId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96 px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Carregando seus fretes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96 px-4">
        <div className="text-center text-red-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4" />
          <p className="text-lg">{error}</p>
          <Button onClick={loadFreights} className="mt-4">Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white py-2 px-4 rounded-lg shadow-md z-50">
          {successMessage}
        </div>
      )}

      {/* ✅ OTIMIZADO: Header responsivo */}
      <div className="mb-4 sm:mb-6">
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center">
            <div className="bg-white/20 p-2 sm:p-3 rounded-full mb-3 sm:mb-0 sm:mr-4">
              <Truck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="w-full">
              <h1 className="text-xl sm:text-2xl font-bold mb-2">Meus Fretes</h1>
              {currentUser && (
                <div className="space-y-1">
                  <p className="text-green-100 text-sm sm:text-base flex items-center">
                    <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                    {currentUser.fullName}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm">
                    <span className="text-green-100">CPF: {currentUser.cpf}</span>
                    <span className="text-green-100">Tel: {currentUser.phone || 'Não informado'}</span>
                  </div>
                  {currentUser.carrierName && (
                    <p className="text-green-100 text-xs sm:text-sm">
                      Transportadora: {currentUser.carrierName}
                    </p>
                  )}
                  {currentUser.assignedMapNumber && (
                    <p className="text-green-100 text-xs sm:text-sm">
                      Mapa: {currentUser.assignedMapNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ OTIMIZADO: Lista de fretes responsiva */}
      <div className="space-y-3 sm:space-y-4">
        {assignedFreights.length === 0 ? (
          <Card className="text-center py-8 sm:py-12 mx-auto max-w-md">
            <CardContent>
              <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
              <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-2">Nenhum frete atribuído</h3>
              <p className="text-sm sm:text-base text-gray-500 px-4">
                Quando fretes forem atribuídos a você, eles aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          assignedFreights.map((freight) => {
            // ✅ LOG: Inspecionar os dados de cada frete antes de renderizar
            console.log(`[Render] Dados do frete #${freight.mapNumber}:`, {
                deliveredStops: freight.deliveredStops,
                failedStops: freight.failedStops, // Log the new prop
                trackingStatus: freight.trackingStatus,
                routeDataExists: !!freight.routeData
            });

            let currentStatus = freight.trackingStatus || 'waiting';

            return (
              <Card key={freight.id} className="shadow-lg overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 p-4" 
                  onClick={() => toggleExpanded(freight.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0">
                    <div className="flex-1">
                      <CardTitle className="flex items-center text-base sm:text-lg">
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
                        Mapa {freight.mapNumber}
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{freight.origin} → {freight.destination}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          {format(new Date(freight.loadingDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                        <div className="flex items-center">
                          <Weight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          {freight.weight?.toLocaleString('pt-BR')} kg
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2">
                      <Badge className={`${getStatusBadge(currentStatus).color} text-xs`}>
                        {getStatusBadge(currentStatus).label}
                      </Badge>
                      <Button variant="outline" size="sm" className="text-xs">
                        {expandedFreight === freight.id ? 'Recolher' : 'Expandir'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedFreight === freight.id && (
                  <CardContent className="pt-0 p-4">
                    <div className="space-y-4 sm:space-y-6">
                      {/* ✅ OTIMIZADO: Layout responsivo para detalhes */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Informações detalhadas */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Detalhes da Carga</h4>
                            <div className="space-y-2 text-xs sm:text-sm bg-gray-50 rounded-lg p-3">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Distância:</span>
                                <span className="font-medium">{freight.totalKm} km</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Tipo de Caminhão:</span>
                                <span className="font-medium text-right">{freight.truckType}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Modalidade:</span>
                                <span className="font-medium">{freight.loadingMode}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Transportadora:</span>
                                <span className="font-medium text-right">{freight.selectedCarrier}</span>
                              </div>
                            </div>
                          </div>

                          {/* ✅ NOVO: Seção de Ocorrências */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base flex items-center">
                              <FileText className="w-4 h-4 mr-2" />
                              Ocorrências
                            </h4>
                            
                            {/* Lista de ocorrências existentes */}
                            {freight.occurrences && freight.occurrences.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {freight.occurrences.map((occurrence) => (
                                  <div key={occurrence.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-xs sm:text-sm text-gray-800">{occurrence.description}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(occurrence.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Formulário para nova ocorrência */}
                            {showOccurrenceForm === freight.id ? (
                              <div className="space-y-3 bg-white border rounded-lg p-3">
                                <Textarea
                                  value={newOccurrence}
                                  onChange={(e) => setNewOccurrence(e.target.value)}
                                  placeholder="Descreva a ocorrência..."
                                  rows={3}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => addOccurrence(freight.id)}
                                    className="bg-orange-600 hover:bg-orange-700 text-xs"
                                    disabled={!newOccurrence.trim()}
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setShowOccurrenceForm(null);
                                      setNewOccurrence('');
                                    }}
                                    className="text-xs"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowOccurrenceForm(freight.id)}
                                className="w-full text-xs border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Registrar Ocorrência
                              </Button>
                            )}
                          </div>

                          {/* ✅ NOVO: Seção de Anexos */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base flex items-center">
                              <Camera className="w-4 h-4 mr-2" />
                              Anexos
                            </h4>

                            {/* Lista de imagens anexadas */}
                            {freight.occurrenceImages && freight.occurrenceImages.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                {freight.occurrenceImages.map((image, index) => (
                                  <div key={index} className="relative group">
                                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                                      <img
                                        src={image.url}
                                        alt={image.name || `Ocorrência ${index + 1}`}
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => {
                                          setCurrentImagePreview(image.url);
                                          setShowImageModal(true);
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                    <div className="mt-1 text-center">
                                      <p className="text-xs text-gray-600 truncate">
                                        {image.name || `Foto ${index + 1}`}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {format(new Date(image.timestamp), 'dd/MM HH:mm', { locale: ptBR })}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Botão para adicionar imagem */}
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, freight.id)}
                                disabled={uploadingImage}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={uploadingImage}
                                className="w-full text-xs border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                              >
                                {uploadingImage ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Enviando...
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-3 h-3 mr-1" />
                                    Anexar Foto
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {freight.routeInfo && (
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Observações da Rota</h4>
                              <p className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                {freight.routeInfo}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* NEW: Route Stops Display and Tracking Timeline Section */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Roteiro Detalhado</h4>
                          {freight.routeData ? (
                            <RouteStopsDisplay
                              freight={freight}
                              currentUser={currentUser}
                              deliveredStops={freight.deliveredStops || []}
                              failedStops={freight.failedStops || []}
                              handleUpdateStatus={handleUpdateStatus}
                              loadingMapId={loadingMapId}
                              setLoadingMapId={setLoadingMapId}
                              handleInitialStatusUpdate={handleInitialStatusUpdate}
                              loadFreights={loadFreights} // Pass loadFreights to RouteStopsDisplay
                            />
                          ) : (
                            <div className="text-sm text-gray-500 text-center py-4">
                              Nenhum detalhe de rota disponível para o progresso de entrega.
                            </div>
                          )}
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base mt-6">Histórico do Frete</h4>
                          <TrackingTimeline history={freight.trackingHistory || []} />
                        </div>
                      </div>

                      {/* ✅ OTIMIZADO: Mapa responsivo */}
                      {freight.routeData && (
                        <div className="mt-4 sm:mt-6">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base flex items-center">
                            <Route className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                            Visualização no Mapa
                          </h4>
                          <div className="w-full">
                            <RouteMapComponent
                              origin={freight.routeData.origin?.coordinates}
                              destination={freight.routeData.destination?.coordinates}
                              waypoints={freight.routeData.waypoints}
                              route={freight.routeData.routes?.economic || freight.routeData.routes?.shortest}
                              height="300px"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
                {/* Changed CardFooter to justify-between as per outline */}
                <CardFooter className="bg-gray-50 p-3 flex justify-between items-center"></CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* ✅ NOVO: Modal de confirmação de entrega */}
      {showDeliveryConfirmModal && pendingDelivery && (
        <Dialog open={showDeliveryConfirmModal} onOpenChange={setShowDeliveryConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
                Confirmar Entrega
              </DialogTitle>
            </DialogHeader>
            
            {!showNotDeliveredForm ? (
              <>
                <div className="py-4">
                  <p className="text-gray-700 text-center text-lg">
                    A entrega em <span className="font-bold">{pendingDelivery.stopToDeliver.city}</span> foi concluída?
                  </p>
                </div>
                <DialogFooter className="grid grid-cols-2 gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleShowNotDeliveredForm}
                    disabled={loadingMapId === pendingDelivery.freight.id}
                  >
                    Não
                  </Button>
                  <Button
                    onClick={handleConfirmDelivery}
                    disabled={loadingMapId === pendingDelivery.freight.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Sim
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="py-4 space-y-4">
                  <p className="text-gray-700">
                    Por que a entrega em <span className="font-bold">{pendingDelivery.stopToDeliver.city}</span> não foi realizada?
                  </p>
                  <Textarea
                    value={notDeliveredReason}
                    onChange={(e) => setNotDeliveredReason(e.target.value)}
                    placeholder="Descreva o motivo (ex: destinatário ausente, endereço não localizado, etc.)"
                    rows={3}
                    className="w-full"
                  />
                </div>
                <DialogFooter className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                        setShowNotDeliveredForm(false);
                        setNotDeliveredReason('');
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSaveNotDelivered} // Using the correct function name
                    disabled={!notDeliveredReason.trim() || loadingMapId === pendingDelivery.freight.id}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ✅ NOVO: Modal de Visualização de Imagem */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-4">
          <DialogHeader>
            <DialogTitle>Visualização da Imagem</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center">
            <img
              src={currentImagePreview}
              alt="Imagem da Ocorrência"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
