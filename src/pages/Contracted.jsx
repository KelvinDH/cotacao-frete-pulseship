
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Calendar, MapPin, Loader2, Search, ChevronDown, ChevronUp, FileText, Upload, Eye, Trash2, Download, DollarSign, TrendingDown, Percent, Route, Weight, Truck as TruckIcon, Edit, CheckCircle, Clock, Handshake as HandshakeIcon, Users, Map, Paperclip, AlertTriangle, User as UserIcon, Truck, BarChart2, Save, Ban, X, CalendarDays, ChevronLeft, ChevronRight, ArrowLeftCircle, AlertCircle, ReceiptText, UserCircle, ZoomIn, UserPlus, UserCheck, XCircle, Phone, Building, Filter } from "lucide-react";
import { FreightMap, User, UploadFile, TruckType, Carrier } from "@/components/ApiDatabase";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import RouteMapComponent from '../components/RouteMapComponent';
import DriverModal from '../components/DriverModal';
import TrackingTimeline from '../components/TrackingTimeline';
import SelectDriverModal from '../components/SelectDriverModal';
import RouteDetails from '../components/RouteDetails';
import RouteStopsDisplay from '../components/RouteStopsDisplay';

// ✅ COMPONENTE NOVO: Para exibir informações do motorista
const DriverInfoDisplay = ({ assignedDriver, getDriverDetails }) => {
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDriverInfo = async () => {
      if (!assignedDriver) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        console.log(`🔍 Buscando informações do motorista: ${assignedDriver}`);
        const info = await getDriverDetails(assignedDriver);
        
        if (info) {
          setDriverInfo(info);
        } else {
          setError(`Motorista não encontrado (CPF/ID: ${assignedDriver})`);
        }
      } catch (err) {
        console.error('❌ Erro ao carregar informações do motorista:', err);
        setError('Erro ao carregar informações do motorista');
      } finally {
        setLoading(false);
      }
    };

    loadDriverInfo();
  }, [assignedDriver, getDriverDetails]);

  if (loading) {
    return (
      <div className="flex items-center text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        Carregando informações do motorista...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm flex items-center">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        {error}
      </div>
    );
  }

  if (!driverInfo) {
    return (
      <div className="text-gray-500 text-sm">
        Informações do motorista não disponíveis
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <UserIcon className="w-4 h-4 mr-2 text-gray-500" />
        <span className="text-sm">
          <strong>Nome:</strong> {driverInfo.name}
        </span>
      </div>
      <div className="flex items-center">
        <FileText className="w-4 h-4 mr-2 text-gray-500" />
        <span className="text-sm">
          <strong>CPF:</strong> {driverInfo.cpf}
        </span>
      </div>
      {driverInfo.phone && (
        <div className="flex items-center">
          <Phone className="w-4 h-4 mr-2 text-gray-500" />
          <span className="text-sm">
            <strong>Telefone:</strong> {driverInfo.phone}
          </span>
        </div>
      )}
      {driverInfo.carrierName && (
        <div className="flex items-center">
          <Building className="w-4 h-4 mr-2 text-gray-500" />
          <span className="text-sm">
            <strong>Transportadora:</strong> {driverInfo.carrierName}
          </span>
        </div>
      )}
    </div>
  );
};


export default function ContractedPage() {
  const [contractedFreights, setContractedFreights] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMap, setExpandedMap] = useState(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [loadingExpandedMap, setLoadingExpandedMap] = useState(null); // ✅ NOVO ESTADO: Para loading do card

  const [uploadingFiles, setUploadingFiles] = useState({});

  const [lastViewedAttachments, setLastViewedAttachments] = useState({});
  const [allFreightMaps, setAllFreightMaps] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);

  // Estados para edição completa
  // Removed editingMapId, now managed by editModalOpen and editingFreight
  const [editingFreight, setEditingFreight] = useState(null); // The freight object being edited
  const [originalEditData, setOriginalEditData] = useState({}); // To detect changes
  const [editObservation, setEditObservation] = useState('');
  const [truckTypes, setTruckTypes] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // NEW STATE: For controlling the edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Novos estados para reabrir negociação
  const [reopeningFreight, setReopeningFreight] = useState(null);
  const [reopenJustification, setReopenJustification] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  // NEW STATES for image modal (for RouteMapComponent image preview)
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImagePreview, setCurrentImagePreview] = useState('');

  // ✅ NOVOS ESTADOS: Para modal de motorista
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedMapForDriver, setSelectedMapForDriver] = useState(null);
  const [showSelectDriverModal, setShowSelectDriverModal] = useState(false); // ✅ NOVO: Para modal de seleção de motorista existente

  // ✅ NOVO ESTADO: Para a seção de ocorrências
  const [isOccurrencesExpanded, setIsOccurrencesExpanded] = useState(false);

  // ✅ NOVOS ESTADOS: Para filtros
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all');

  // Placeholder for sendEmail function - in a real app, this would be an actual import from a utility file
  const sendEmail = async ({ to, subject, html }) => {
    console.log(`Simulating email send to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html}`);
    // In a real application, you'd integrate with an email service here.
    return new Promise(resolve => setTimeout(() => resolve({ success: true }), 500));
  };

  const getBrazilIsoNow = () => {
    const now = new Date();
    // This is a simplified approach for Brazil's timezone (GMT-3 for most of the year).
    // For production, consider using a more robust library like date-fns-tz.
    const offset = now.getTimezoneOffset() + (3 * 60); // Adjusting local offset to Brazil's GMT-3 offset
    const brazilTime = new Date(now.getTime() - (offset * 60 * 1000));
    return brazilTime.toISOString();
  };

  // ✅ FUNÇÃO CORRIGIDA: Usar User.list() em vez de User.filter()
  const getDriverDetails = async (assignedDriver) => {
    if (!assignedDriver) return null;
    
    try {
      console.log(`🔍 Buscando motorista com identificador: ${assignedDriver}`);
      
      // ✅ CORREÇÃO: Usar User.list() que existe na API
      const allUsers = await User.list();
      console.log(`📋 Total de usuários encontrados: ${allUsers.length}`);
      
      // Buscar motorista por CPF, ID ou assignedMapNumber
      const foundDriver = allUsers.find(user => {
        const isDriver = user.userType === 'driver';
        const matchesCpf = user.cpf === assignedDriver;
        const matchesId = user.id == assignedDriver || user.id === assignedDriver;
        const matchesMapNumber = user.assignedMapNumber === assignedDriver;
        
        console.log(`🔍 Verificando usuário: ${user.fullName} (ID: ${user.id}, CPF: ${user.cpf}, Tipo: ${user.userType})`);
        console.log(`   - É motorista: ${isDriver}`);
        console.log(`   - CPF match: ${matchesCpf}`);
        console.log(`   - ID match: ${matchesId}`);
        console.log(`   - MapNumber match: ${matchesMapNumber}`);
        
        return isDriver && (matchesCpf || matchesId || matchesMapNumber);
      });
      
      if (foundDriver) {
        console.log(`✅ Motorista encontrado:`, foundDriver);
        return {
          name: foundDriver.fullName || foundDriver.name || 'Nome não informado',
          cpf: foundDriver.cpf || 'CPF não informado',
          phone: foundDriver.phone || 'Telefone não informado',
          carrierName: foundDriver.carrierName || 'Transportadora não informada'
        };
      }
      
      console.warn(`⚠️ Motorista não encontrado para identificador: ${assignedDriver}`);
      
      // ✅ FALLBACK: Se não encontrar, retorna informações básicas
      return {
        name: 'Motorista não identificado',
        cpf: assignedDriver,
        phone: 'Não informado',
        carrierName: 'Não informada'
      };
      
    } catch (error) {
      console.error('❌ Erro ao buscar motorista:', error);
      
      // ✅ FALLBACK: Em caso de erro, retorna informações básicas
      return {
        name: 'Erro ao carregar motorista',
        cpf: assignedDriver,
        phone: 'Não disponível',
        carrierName: 'Não disponível'
      };
    }
  };

  useEffect(() => {
    loadData();
    // Carregar os timestamps de visualização do localStorage
    loadLastViewedTimes();
  }, []);

  const loadLastViewedTimes = () => {
    try {
      const stored = localStorage.getItem('lastViewedAttachments');
      if (stored) {
        setLastViewedAttachments(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar timestamps de visualização:', error);
    }
  };

  const markAttachmentAsViewed = (freightId) => {
    const now = new Date().toISOString();
    const updated = {
      ...lastViewedAttachments,
      [freightId]: now
    };
    setLastViewedAttachments(updated);
    localStorage.setItem('lastViewedAttachments', JSON.stringify(updated));
  };

  // Helper function to check for new attachments for a specific freight map ID
  const hasNewAttachmentsForFreightId = (freightId, invoiceUrls) => {
    if (!invoiceUrls || invoiceUrls.length === 0) {
      return false;
    }
    const lastViewedTime = lastViewedAttachments[freightId];
    if (!lastViewedTime) {
      return true; // Never viewed before
    }
    const hasNewerAttachment = invoiceUrls.some(invoice =>
      new Date(invoice.uploadedAt) > new Date(lastViewedTime)
    );
    return hasNewerAttachment;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const allMaps = await FreightMap.list('-created_date');
      // ✅ CORREÇÃO: Verificar se os campos existem antes de fazer JSON.parse
      const parsedAllMaps = await Promise.all(allMaps.map(async m => {
        const freight = {
          ...m,
          trackingHistory: m.trackingHistory ? (typeof m.trackingHistory === 'string' ? JSON.parse(m.trackingHistory) : m.trackingHistory) : [],
          invoiceUrls: m.invoiceUrls ? (typeof m.invoiceUrls === 'string' ? JSON.parse(m.invoiceUrls) : m.invoiceUrls) : [],
          // ✅ CRUCIAL: Garantir que deliveredStops seja sempre um array ao carregar
          deliveredStops: m.deliveredStops ? (Array.isArray(m.deliveredStops) ? m.deliveredStops : (typeof m.deliveredStops === 'string' ? JSON.parse(m.deliveredStops) : [])) : [],
          // ✅ NOVO: Garantir que failedStops seja sempre um array ao carregar
          failedStops: m.failedStops ? (Array.isArray(m.failedStops) ? m.failedStops : (typeof m.failedStops === 'string' ? JSON.parse(m.failedStops) : [])) : [],
          occurrences: m.occurrences ? (Array.isArray(m.occurrences) ? m.occurrences : (typeof m.occurrences === 'string' ? JSON.parse(m.occurrences) : [])) : [],
          occurrenceImages: m.occurrenceImages ? (Array.isArray(m.occurrenceImages) ? m.occurrenceImages : (typeof m.occurrenceImages === 'string' ? JSON.parse(m.occurrenceImages) : [])) : []
        };
        // Pre-resolve driver details for initial load
        // NOTE: This pre-resolution is kept for potential future uses, but DriverInfoDisplay now handles its own fetch.
        if (freight.assignedDriver) {
            freight.resolvedDriverDetails = await getDriverDetails(freight.assignedDriver);
        }
        return freight;
      }));
      setAllFreightMaps(parsedAllMaps);

      // Carregar dados para edição e todos os usuários
      const [truckTypesList, carriersList, usersList] = await Promise.all([
        TruckType.list(),
        Carrier.list(),
        User.list()
      ]);
      setTruckTypes(truckTypesList);
      setCarriers(carriersList);
      setAllUsers(usersList);
      const drivers = usersList.filter(u => u.userType === 'driver');
      setAllDrivers(drivers);

      let freightsToDisplay;
      if (user && user.userType === 'carrier') {
        freightsToDisplay = parsedAllMaps.filter(map =>
          map.status === 'contracted' && map.selectedCarrier === user.carrierName
        );
      } else {
        freightsToDisplay = parsedAllMaps.filter(map => map.status === 'contracted');
      }
      setContractedFreights(freightsToDisplay);
    } catch (error) {
      console.error('Error loading fretes:', error);
      alert('Erro ao carregar fretes. Verifique se a API está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const brazilDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return format(brazilDate, 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error);
      return 'Data inválida';
    }
  };

  const formatToBrazilTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const brazilDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return format(brazilDate, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data e hora:", error);
      return 'Data/Hora inválida';
    }
  };

  const handleFileUpload = async (event, freightId) => {
    const files = Array.from(event.target.files);
    const validExtensions = ['pdf', 'xml', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const maxFileSizeMB = 10;
    const maxFileSize = maxFileSizeMB * 1024 * 1024;

    const validFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!validExtensions.includes(extension)) {
        alert(`O arquivo ${file.name} tem uma extensão não permitida (${extension}). Apenas ${validExtensions.join(', ')} são aceitos.`);
        return false;
      }
      if (file.size > maxFileSize) {
        alert(`O arquivo ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) excede o tamanho máximo permitido de ${maxFileSizeMB} MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      return;
    }

    setUploadingFiles(prev => ({ ...prev, [freightId]: true }));

    try {
      const uploadedBy = currentUser?.userType === 'carrier' ? currentUser.carrierName : currentUser?.email;

      const uploadPromises = validFiles.map(async (file) => {
        const result = await UploadFile({ file });
        return {
          name: file.name,
          url: result.file_url,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploadedBy || 'Sistema'
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      const freight = contractedFreights.find(f => f.id === freightId);
      const currentInvoices = freight.invoiceUrls || [];
      const updatedInvoices = [...currentInvoices, ...uploadedFiles];

      await FreightMap.update(freightId, { invoiceUrls: JSON.stringify(updatedInvoices) });

      await loadData();
      alert(`${uploadedFiles.length} arquivo(s) enviado(s) com sucesso!`);

      localStorage.setItem('newInvoiceUploaded', new Date().toISOString());

    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Erro ao enviar arquivos.");
    } finally {
      setUploadingFiles(prev => ({ ...prev, [freightId]: false }));
    }
  };

  const handleDeleteFile = async (freightId, fileUrl) => {
    if (!window.confirm('Confirma a remoção deste arquivo?')) return;

    try {
      const freight = contractedFreights.find(f => f.id === freightId);
      const updatedInvoices = freight.invoiceUrls.filter(invoice => invoice.url !== fileUrl);

      await FreightMap.update(freightId, { invoiceUrls: JSON.stringify(updatedInvoices) });
      await loadData();
      alert('Arquivo removido com sucesso!');
    } catch (error) {
      console.error("Error removing invoice:", error);
      alert("Erro ao remover arquivo.");
    }
  };

  const handleDeleteFreight = async (freightId, mapNumber) => {
    if (window.confirm(`Tem certeza que deseja excluir permanentemente o mapa ${mapNumber}? Esta ação é irreversível.`)) {
      try {
        await FreightMap.delete(freightId);
        alert(`Mapa ${mapNumber} excluído com sucesso.`);
        await loadData();
      } catch (error) {
        console.error("Ocorreu um erro ao excluir o frete:", error);
        alert("Ocorreu um erro ao excluir o frete.");
      }
    }
  };

  // NEW FUNCTION: Open edit modal
  const handleStartEdit = (freight) => {
    setEditingFreight({
      ...freight,
      loadingDate: freight.loadingDate ? new Date(freight.loadingDate) : null, // Ensure Date object
    });
    setOriginalEditData({
      mapValue: freight.mapValue,
      selectedCarrier: freight.selectedCarrier,
      finalValue: freight.finalValue || freight.mapValue,
    });
    setEditObservation('');
    setShowImagePreview(false); // Close preview if open
    setEditModalOpen(true); // Open the modal
  };

  // NEW FUNCTION: Close edit modal
  const handleCancelEdit = () => {
    setEditModalOpen(false); // Close the modal
    setEditingFreight(null);
    setOriginalEditData({});
    setEditObservation('');
    setShowImagePreview(false);
  };

  // Save full edit
  const handleSaveEdit = async () => {
    if (!editingFreight) return; // Should not happen if modal is open

    const valueChanged = parseFloat(editingFreight.mapValue) !== parseFloat(originalEditData.mapValue);
    const carrierChanged = editingFreight.selectedCarrier !== originalEditData.selectedCarrier;
    const finalValueChanged = parseFloat(editingFreight.finalValue) !== parseFloat(originalEditData.finalValue);

    if ((valueChanged || carrierChanged || finalValueChanged) && !editObservation.trim()) {
      alert('A observação é obrigatória ao alterar o valor do frete, transportadora ou valor final.');
      return;
    }

    try {
      const updatedEditObservations = [...(editingFreight.editObservations || [])];
      if (valueChanged || carrierChanged || finalValueChanged) {
        let details = [];
        if (valueChanged) {
          details.push(`Valor do mapa alterado de R$ ${originalEditData.mapValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${parseFloat(editingFreight.mapValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
        if (carrierChanged) {
          details.push(`Transportadora alterada de "${originalEditData.selectedCarrier}" para "${editingFreight.selectedCarrier}"`);
        }
        if (finalValueChanged) {
          details.push(`Valor final alterado de R$ ${originalEditData.finalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${parseFloat(editingFreight.finalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }

        const newObservation = {
          observation: editObservation,
          user: currentUser.fullName || currentUser.email,
          timestamp: new Date().toISOString(),
          details: details.join('. ')
        };
        updatedEditObservations.push(newObservation);
      }

      const updateData = {
        ...editingFreight,
        loadingDate: editingFreight.loadingDate ? format(editingFreight.loadingDate, 'yyyy-MM-dd') : null, // Convert Date object to string
        managers: editingFreight.managers || [],
        editObservations: JSON.stringify(updatedEditObservations) // Stringify before saving
      };

      await FreightMap.update(editingFreight.id, updateData);
      alert('Dados atualizados com sucesso!');
      handleCancelEdit(); // This now closes the modal and resets states
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      alert("Falha ao salvar. Tente novamente.");
    }
  };

  // Upload image in edit
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await UploadFile({ file });
      setEditingFreight(prev => ({ ...prev, mapImage: file_url }));
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove image in edit
  const removeEditImage = () => {
    setEditingFreight(prev => ({ ...prev, mapImage: '' }));
  };

  // Filter truck types by modality
  const getFilteredTruckTypes = (loadingMode) => {
    if (!loadingMode || !truckTypes) return [];
    const compatibleModality = loadingMode.includes('fracionado') ? loadingMode.replace('_fracionado', '') : loadingMode;
    return truckTypes.filter(truck => truck.modality === compatibleModality);
  };

  const getModalityText = (loadingMode) => {
    switch (loadingMode) {
      case 'paletizados': return '📦 Paletizados';
      case 'bag': return '🎒 BAG';
      case 'granel': return '🌾 Granel';
      case 'bag_fracionado': return '🎒 BAG Fracionado';
      case 'paletizados_fracionado': return '📦 Paletizados Fracionado';
      default: return loadingMode;
    }
  };

  const getPageTitle = () => {
    if (currentUser && currentUser.userType === 'carrier') {
      return 'Fretes Fechados';
    }
    return 'Fretes Contratados';
  };

  const getPageSubTitle = () => {
    if (currentUser && currentUser.userType === 'carrier') {
      return "Visualize o histórico de seus fretes concluídos.";
    }
    return "Gerencie e visualize todos os fretes contratados.";
  };

  // ✅ FUNÇÃO ATUALIZADA: Para buscar dados ao expandir
  const toggleMapExpansion = async (mapNumber, freightId) => {
    const isOpening = expandedMap !== mapNumber;
    setExpandedMap(isOpening ? mapNumber : null);
    setIsDetailsExpanded(false); // Reset details expansion when card expands/collapses
    setIsOccurrencesExpanded(false); // Reset occurrences expansion when card expands/collapses

    if (isOpening) {
      setLoadingExpandedMap(mapNumber);
      try {
        const latestFreightData = await FreightMap.get(freightId);
        
        const parsedLatestFreightData = {
          ...latestFreightData,
          trackingHistory: latestFreightData.trackingHistory ? (typeof latestFreightData.trackingHistory === 'string' ? JSON.parse(latestFreightData.trackingHistory) : latestFreightData.trackingHistory) : [],
          invoiceUrls: latestFreightData.invoiceUrls ? (typeof latestFreightData.invoiceUrls === 'string' ? JSON.parse(latestFreightData.invoiceUrls) : latestFreightData.invoiceUrls) : [],
          deliveredStops: latestFreightData.deliveredStops ? (Array.isArray(latestFreightData.deliveredStops) ? latestFreightData.deliveredStops : (typeof latestFreightData.deliveredStops === 'string' ? JSON.parse(latestFreightData.deliveredStops) : [])) : [],
          failedStops: latestFreightData.failedStops ? (Array.isArray(latestFreightData.failedStops) ? latestFreightData.failedStops : (typeof latestFreightData.failedStops === 'string' ? JSON.parse(latestFreightData.failedStops) : [])) : [], // ✅ NOVO: parsing de failedStops
          occurrences: latestFreightData.occurrences ? (Array.isArray(latestFreightData.occurrences) ? latestFreightData.occurrences : (typeof latestFreightData.occurrences === 'string' ? JSON.parse(latestFreightData.occurrences) : [])) : [],
          occurrenceImages: latestFreightData.occurrenceImages ? (Array.isArray(latestFreightData.occurrenceImages) ? latestFreightData.occurrenceImages : (typeof latestFreightData.occurrenceImages === 'string' ? JSON.parse(latestFreightData.occurrenceImages) : [])) : []
        };

        // ✅ NEW: Fetch driver details if assignedDriver exists
        if (parsedLatestFreightData.assignedDriver) {
            const driverDetails = await getDriverDetails(parsedLatestFreightData.assignedDriver);
            parsedLatestFreightData.resolvedDriverDetails = driverDetails; // Attach to the freight object
        }
        
        // Atualiza a lista principal com os dados mais recentes
        setAllFreightMaps(prevMaps =>
          prevMaps.map(map => map.id === freightId ? parsedLatestFreightData : map)
        );

      } catch (error) {
        console.error("Falha ao buscar detalhes atualizados do mapa:", error);
        // Não mostraremos mais o alerta irritante. O console log é suficiente para debug.
      } finally {
        setLoadingExpandedMap(null);
      }
    }
  };

  const handleDownload = (freightId, invoice) => {
    markAttachmentAsViewed(freightId);
    window.open(invoice.url, '_blank');
  };

  const handleCardClick = (freightId) => {
    // Only mark as viewed if the card is clicked and has new attachments
    // This is less relevant with the new expansion logic via header click
    // But keeping for general `lastViewedAttachments` management
    // if (hasNewAttachmentsForFreightId(freightId)) {
    //   markAttachmentAsViewed(freightId);
    // }
  };

  // ✅ NOVO: Hook para obter transportadoras únicas para o filtro
  const uniqueCarriers = useMemo(() => {
    const carriers = new Set();
    allFreightMaps.forEach(freight => {
      if (freight.selectedCarrier) {
        carriers.add(freight.selectedCarrier);
      }
    });
    return Array.from(carriers).sort();
  }, [allFreightMaps]);

  // ✅ FUNÇÃO ATUALIZADA: Função para obter o label em português do status de entrega
  const getDeliveryStatusLabel = (status) => {
    const statusLabels = {
      waiting: 'Aguardando',
      loading: 'Carregando',
      in_transit: 'Em Trânsito',
      delivered: 'Entregue',
      delayed: 'Atrasado',
      occurrence_reported: 'Ocorrência Reportada',
      delivery_failed: 'Falha na Entrega',
      delivery_failed_stop: 'Falha em Parada'
    };
    return statusLabels[status] || 'Sem rastreamento';
  };

  // ✅ FUNÇÃO ATUALIZADA: Função para obter a cor do badge do status de entrega
  const getDeliveryStatusColor = (status) => {
    const statusColors = {
      waiting: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      loading: 'bg-blue-100 text-blue-800 border border-blue-200',
      in_transit: 'bg-purple-100 text-purple-800 border border-purple-200',
      delivered: 'bg-green-100 text-green-800 border border-green-200',
      delayed: 'bg-orange-100 text-orange-800 border border-orange-200',
      occurrence_reported: 'bg-red-100 text-red-800 border border-red-200',
      delivery_failed: 'bg-red-100 text-red-800 border border-red-200',
      delivery_failed_stop: 'bg-red-100 text-red-800 border border-red-200'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // ✅ FUNÇÃO ATUALIZADA: getGroupedFreights com filtros aplicados
  const getGroupedFreights = () => {
    const grouped = contractedFreights.reduce((acc, freight) => {
      if (!acc[freight.mapNumber]) {
        acc[freight.mapNumber] = [];
      }
      acc[freight.mapNumber].push(freight);
      return acc;
    }, {});

    const filteredGroups = Object.entries(grouped)
      .filter(([, group]) => {
        const hasContracted = group.some(f => f.status === 'contracted');
        if (!hasContracted) return false;

        if (currentUser && currentUser.userType === 'carrier') {
          return group.some(f => f.selectedCarrier === currentUser.carrierName && f.status === 'contracted');
        }

        return true;
      })
      .filter(([mapNumber, group]) => {
        const mainFreightForFilters = group.find(f => f.status === 'contracted') || group[0];
        if (!mainFreightForFilters) return false;

        const searchMatch = !searchTerm ||
          mapNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mainFreightForFilters.origin && mainFreightForFilters.origin.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (mainFreightForFilters.destination && mainFreightForFilters.destination.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (mainFreightForFilters.selectedCarrier && mainFreightForFilters.selectedCarrier.toLowerCase().includes(searchTerm.toLowerCase()));

        // ✅ NOVOS FILTROS: transportadora, modalidade e status de entrega
        const matchesCarrier = carrierFilter === 'all' || mainFreightForFilters.selectedCarrier === carrierFilter;
        const matchesModality = modalityFilter === 'all' || mainFreightForFilters.loadingMode === modalityFilter;
        const matchesDeliveryStatus = deliveryStatusFilter === 'all' || mainFreightForFilters.trackingStatus === deliveryStatusFilter;
        
        return searchMatch && matchesCarrier && matchesModality && matchesDeliveryStatus;
      })
      .sort(([, groupA], [, groupB]) => {
        return new Date(groupB[0].created_date) - new Date(groupA[0].created_date);
      });

    return filteredGroups;
  };

  // Apply pagination
  const getPaginatedFreights = () => {
    const allGroups = getGroupedFreights();
    const totalItems = allGroups.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Ajustar página atual se necessário
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

  // Navigate pages
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= paginationData.totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Reopen negotiation (UPDATED)
  const handleReopenNegotiation = async () => {
    if (!reopeningFreight) return;

    // Validation
    if (!reopenJustification.trim() || reopenJustification.trim().length < 10) {
      alert('Por favor, forneça uma justificativa com pelo menos 10 caracteres para reabrir a negociação.');
      return;
    }

    setIsReopening(true);
    try {
      // Create observation about reopening
      const reopenObservation = {
        observation: `Frete reaberto para negociação. Justificativa: ${reopenJustification.trim()}`,
        user: currentUser.fullName,
        timestamp: getBrazilIsoNow(),
        details: 'Reabertura para negociação'
      };

      // Update freight to 'negotiating' status and add observation
      const updatedFreight = {
        ...reopeningFreight,
        status: 'negotiating',
        contractedAt: null, // Remove contract date
        finalValue: null, // Remove final value
        justification: null, // Remove previous justification
        finalizationObservation: null, // Remove previous finalization observation
        editObservations: JSON.stringify([...(reopeningFreight.editObservations || []), reopenObservation]), // Stringify observations
        updated_date: getBrazilIsoNow()
      };

      await FreightMap.update(reopeningFreight.id, updatedFreight);

      // Send email to carrier about reopening (preserved)
      try {
        const carrierUser = allUsers.find(user => // Use allUsers state
          user.userType === 'carrier' &&
          user.carrierName === reopeningFreight.selectedCarrier &&
          user.active
        );

        if (carrierUser) {
          const emailSubject = `🔄 Frete Reaberto para Negociação - Mapa ${reopeningFreight.mapNumber}`;
          const emailBody = `
            <h2>Olá, ${carrierUser.fullName}!</h2>
            <p>O frete do mapa <strong>${reopeningFreight.mapNumber}</strong> com rota de <strong>${reopeningFreight.origin}</strong> para <strong>${reopeningFreight.destination}</strong> foi reaberto para negociação.</p>

            <h3>📋 JUSTIFICATIVA PARA REABERTURA:</h3>
            <p><em>"${reopenJustification.trim()}"</em></p>

            <p>Acesse o sistema para visualizar os detalhes e continuar a negociação.</p>

            <p>Atenciosamente,<br>Equipe UnionAgro</p>
          `;

          await sendEmail({
            to: carrierUser.email,
            subject: emailSubject,
            html: emailBody
          });
        } else {
          console.warn(`Carrier user for ${reopeningFreight.selectedCarrier} not found or not active. Email not sent.`);
        }
      } catch (emailError) {
        console.error('Erro ao enviar email de notificação:', emailError);
        // Do not block main flow if email error
      }

      alert('Frete reaberto para negociação com sucesso!');

      // Reset modal states
      setReopeningFreight(null);
      setReopenJustification('');

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Erro ao reabrir frete para negociação:', error);
      alert('Erro ao reabrir frete para negociação. Tente novamente.');
    } finally {
      setIsReopening(false);
    }
  };

  // Function to calculate total cost including tolls
  const getTotalCostWithTolls = (freight) => {
    // This function assumes `routeData.route` contains the selected route.
    // If the data structure has changed to `routeData.routes.economic` or `routeData.routes.shortest`,
    // this function would need to pick the *chosen* route or sum tolls from specific routes.
    // Given the prompt, the display part is changing, but this function's underlying data access
    // should remain valid for the contracted freight's main route details.
    const freightValue = freight.finalValue || 0;
    const tollCost = freight.routeData?.route?.tollData?.totalCost || 0;
    return freightValue + tollCost;
  };

  // Helper function to open DriverModal (renamed from handleRegisterDriver for clarity)
  const openDriverModal = (map) => {
    setSelectedMapForDriver(map);
    setShowDriverModal(true);
  };

  // Helper function to open SelectDriverModal (renamed from handleOpenSelectDriverModal for clarity)
  const openSelectDriverModal = (map) => {
    setSelectedMapForDriver(map);
    setShowSelectDriverModal(true);
  };

  const handleSelectDriver = async (driver) => {
    if (!selectedMapForDriver) return;

    try {
      // ✅ CORREÇÃO: Verificar se trackingHistory existe antes de usá-lo
      const currentHistory = selectedMapForDriver.trackingHistory || [];
      const newHistory = [
        ...currentHistory,
        {
          status: 'waiting',
          timestamp: getBrazilIsoNow(),
          event: `Motorista ${driver.fullName} (${driver.cpf}) vinculado ao mapa e carga aguardando.`,
          driverCpf: driver.cpf,
          user: currentUser.fullName || currentUser.email
        }
      ];

      const updatedData = {
        assignedDriver: driver.cpf,
        trackingStatus: 'waiting',
        trackingHistory: JSON.stringify(newHistory)
      };

      await FreightMap.update(selectedMapForDriver.id, updatedData);

      // Update driver's assignedMapNumber
      await User.update(driver.id, { assignedMapNumber: selectedMapForDriver.mapNumber });


      alert(`Motorista ${driver.fullName} vinculado ao mapa ${selectedMapForDriver.mapNumber} com sucesso!`);
      setShowSelectDriverModal(false);
      setSelectedMapForDriver(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao vincular motorista existente:", error);
      alert("Falha ao vincular motorista. Tente novamente.");
    }
  };

  // ✅ NOVA FUNÇÃO: Callback quando motorista é atribuído (do DriverModal)
  const handleDriverAssigned = async (driverCpf) => { // Expect CPF string
    try {
      if (selectedMapForDriver) {
        const currentTrackingHistory = selectedMapForDriver.trackingHistory || [];
        await FreightMap.update(selectedMapForDriver.id, {
          assignedDriver: driverCpf, // Store CPF
          trackingStatus: 'waiting', // Set initial tracking status
          trackingHistory: JSON.stringify([
            ...currentTrackingHistory,
            {
              status: 'waiting',
              timestamp: getBrazilIsoNow(),
              event: `Motorista com CPF ${driverCpf} vinculado ao mapa e carga aguardando.`,
              driverCpf: driverCpf,
              user: currentUser.fullName || currentUser.email
            }
          ])
        });

        // Recarrega os dados para ter o driver detalhado via lookup
        await loadData();

        const driverDetails = allUsers.find(u => u.cpf === driverCpf);
        const driverName = driverDetails ? driverDetails.fullName : driverCpf;

        // Update driver's assignedMapNumber
        if (driverDetails) {
            await User.update(driverDetails.id, { assignedMapNumber: selectedMapForDriver.mapNumber });
        }


        alert(`Motorista ${driverName} foi vinculado ao mapa ${selectedMapForDriver.mapNumber} com sucesso!`);
      } else {
        console.warn("Selected map not found for assignment.");
        alert('Não foi possível vincular o motorista. Dados inválidos.');
      }
    } catch (error) {
      console.error('Erro ao finalizar vinculação:', error);
      alert('Erro ao finalizar vinculação do motorista');
    }
    setShowDriverModal(false);
    setSelectedMapForDriver(null);
  };

  // NEW HELPER FUNCTIONS FOR TRACKING SECTION
  // This is `getStatusInfo` (not the main badge status, this is for detailed status labels).
  const getStatusInfo = (status) => {
    switch (status) {
      case 'waiting':
        return { 
          label: 'Aguardando Coleta', 
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          icon: <Clock className="w-4 h-4" />
        };
      case 'in_transit':
        return { 
          label: 'Em Trânsito', 
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <Truck className="w-4 h-4" />
        };
      case 'delivered':
        return { 
          label: 'Entregue', 
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: <CheckCircle className="w-4 h-4" />
        };
      case 'delayed':
        return { 
          label: 'Atrasado', 
          color: 'bg-red-100 text-red-800 border-red-300',
          icon: <AlertTriangle className="w-4 h-4" />
        };
      case 'delivery_failed':
        return { 
          label: 'Entrega não Realizada', 
          color: 'bg-red-100 text-red-800 border-red-300',
          icon: <XCircle className="w-4 h-4" />
        };
      default:
        return { 
          label: 'Status Desconhecido', 
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: <AlertTriangle className="w-4 h-4" />
        };
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="ml-3 text-gray-600">Carregando fretes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">{getPageTitle()}</h1>
        <p className="text-gray-600 mt-1">{getPageSubTitle()}</p>
      </div>

      {/* ✅ SEÇÃO ATUALIZADA: Filtros expandidos */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2 text-blue-500" />
          Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar fretes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={carrierFilter} onValueChange={setCarrierFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por transportadora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Transportadoras</SelectItem>
              {uniqueCarriers.map(carrier => (
                <SelectItem key={carrier} value={carrier}>
                  {carrier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modalityFilter} onValueChange={setModalityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Modalidades</SelectItem>
              <SelectItem value="paletizados">📦 Paletizados</SelectItem>
              <SelectItem value="bag">🎒 BAG</SelectItem>
              <SelectItem value="granel">🌾 Granel</SelectItem>
              <SelectItem value="bag_fracionado">🎒 BAG Fracionado</SelectItem>
              <SelectItem value="paletizados_fracionado">📦 Paletizados Fracionado</SelectItem>
            </SelectContent>
          </Select>

          {/* ✅ NOVO: Filtro de status de entrega */}
          <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status da Entrega" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="waiting">🕐 Aguardando</SelectItem>
              <SelectItem value="loading">📦 Carregando</SelectItem>
              <SelectItem value="in_transit">🚛 Em Trânsito</SelectItem>
              <SelectItem value="delivered">✅ Entregue</SelectItem>
              <SelectItem value="delayed">⏰ Atrasado</SelectItem>
              <SelectItem value="occurrence_reported">⚠️ Ocorrência Reportada</SelectItem>
              <SelectItem value="delivery_failed">❌ Falha na Entrega</SelectItem>
              <SelectItem value="delivery_failed_stop">🛑 Falha em Parada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {paginationData.groups.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Nenhum frete encontrado.</p>
        </div>
      ) : (
        <>
          {/* Paginação Info */}
          <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
            <p>
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, paginationData.totalItems)} de {paginationData.totalItems} frete(s)
            </p>
            <p>Página {currentPage} de {paginationData.totalPages}</p>
          </div>

          <div className="space-y-6">
            {paginationData.groups.map(([mapNumber, freightsInGroup]) => {
              const firstFreight = allFreightMaps.find(f => f.mapNumber === mapNumber && f.status === 'contracted') || freightsInGroup[0]; // Ensure we get the most updated one from allFreightMaps
              const isCardExpanded = expandedMap === mapNumber;

              const allProposalsForMap = allFreightMaps
                .filter(map => map.mapNumber === mapNumber)
                .flatMap(map => map.carrierProposals ? Object.values(map.carrierProposals) : [])
                .filter(value => typeof value === 'number' && value > 0);

              const totalPropostas = allProposalsForMap.length;
              const menorProposta = totalPropostas > 0 ? Math.min(...allProposalsForMap) : 0;
              const maiorProposta = totalPropostas > 0 ? Math.max(...allProposalsForMap) : 0;
              

              const allRelevantProposalsMaps = allFreightMaps.filter(
                map => map.mapNumber === mapNumber &&
                map.carrierProposals &&
                Object.keys(map.carrierProposals).length > 0
              );

              // Combine attachments from all freights in the group for display
              const allGroupAttachments = freightsInGroup.flatMap(f =>
                f.invoiceUrls ? f.invoiceUrls.map(inv => ({ invoice: inv, freightMapId: f.id })) : []
              ).sort((a, b) => new Date(b.invoice.uploadedAt) - new Date(a.invoice.uploadedAt)); // Sort by uploaded date, newest first

              const groupHasNewAttachments = freightsInGroup.some(freight => hasNewAttachmentsForFreightId(freight.id, freight.invoiceUrls));

              return (
                <Card
                  key={mapNumber}
                  className={`overflow-hidden shadow-lg transition-all duration-300 ${groupHasNewAttachments
                    ? 'bg-purple-50 border-2 border-purple-400 cursor-pointer'
                    : 'border-2 border-transparent hover:border-blue-300'
                    }`}
                >
                  <CardHeader
                    className="flex flex-row items-center justify-between cursor-pointer p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200"
                    onClick={() => toggleMapExpansion(mapNumber, firstFreight.id)} // ✅ ATUALIZADO
                  >
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Mapa {mapNumber}
                        </span>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          ✅ Contratado
                        </Badge>
                        {getModalityText(firstFreight.loadingMode) && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            {getModalityText(firstFreight.loadingMode)}
                          </Badge>
                        )}
                        {groupHasNewAttachments && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs animate-pulse">
                            📎 Novos Anexos
                          </Badge>
                        )}
                        {/* ✅ ATUALIZADO: Badge de Status de Rastreamento usando as novas funções */}
                        <Badge className={`${getDeliveryStatusColor(firstFreight.trackingStatus || 'waiting')}`}>
                          <Truck className="w-3 h-3 mr-1" />
                          {getDeliveryStatusLabel(firstFreight.trackingStatus || 'waiting')}
                        </Badge>
                      </CardTitle>
                      {/* ✅ NOVO: Informação de quem cotou */}
                      {firstFreight.created_by && firstFreight.created_by !== 'system' && (
                        <div className="flex items-center text-gray-600 font-medium mb-2 pb-2 border-b">
                          <UserIcon className="w-4 h-4 mr-2 text-indigo-500" />
                          <span>Cotado por: <strong>{firstFreight.created_by}</strong></span>
                        </div>
                      )}
                      <p className="text-gray-600 mt-1 text-sm">
                        <span className="font-medium">{firstFreight.origin}</span> → <span className="font-medium">{firstFreight.destination}</span>
                        <span className="mx-2">•</span>
                        <span>{firstFreight.totalKm} km</span>
                        <span className="mx-2">•</span>
                        <span>{firstFreight.weight?.toLocaleString('pt-BR')} kg</span>
                        <span className="mx-2">•</span>
                        <span className="font-medium text-green-600">{firstFreight.selectedCarrier}</span>
                      </p>
                    </div>

                    {/* Buttons: Edit and Delete */}
                    {currentUser?.userType !== 'carrier' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { // Stop propagation
                            e.stopPropagation();
                            handleStartEdit(firstFreight);
                          }}
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Frete
                        </Button>
                        {/* NEW ACTION: Button to reopen negotiation (only for admin/user) */}
                        {currentUser && (currentUser.userType === 'admin' || currentUser.userType === 'user') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { // Stop propagation
                              e.stopPropagation();
                              setReopeningFreight(firstFreight);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300"
                          >
                            <ArrowLeftCircle className="w-4 h-4 mr-2" />
                            Reabrir Negociação
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { // Stop propagation
                            e.stopPropagation();
                            handleDeleteFreight(firstFreight.id, firstFreight.mapNumber);
                          }}
                          className="bg-red-600 text-white hover:bg-red-700"
                          title={`Excluir Mapa ${firstFreight.mapNumber}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    )}
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transform transition-transform ${
                        isCardExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </CardHeader>

                  {isCardExpanded && (
                    <CardContent className="p-4 md:p-6 space-y-6">
                      {/* ✅ ADICIONADO: Loading state ao expandir */}
                      {loadingExpandedMap === mapNumber ? (
                          <div className="flex flex-col items-center justify-center h-40">
                            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                            <p className="mt-3 text-gray-600">Atualizando dados...</p>
                          </div>
                      ) : (
                        <div className="space-y-6">
                          {/* ✅ SEMPRE MOSTRAR: Informações do Motorista */}
                          {firstFreight.assignedDriver && (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <UserIcon className="w-5 h-5 mr-2 text-blue-500" />
                                Motorista Responsável
                              </h3>
                              <DriverInfoDisplay assignedDriver={firstFreight.assignedDriver} getDriverDetails={getDriverDetails} />
                              {(currentUser?.userType === 'admin' || currentUser?.userType === 'user') && (
                                <div className="flex justify-end mt-4">
                                  <Button
                                    onClick={() => openDriverModal(firstFreight)}
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700"
                                  >
                                    <UserIcon className="w-4 h-4 mr-2" />
                                    Trocar Motorista
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* If no driver, show options to assign (only for admin/user) */}
                          {!firstFreight.assignedDriver && (currentUser?.userType === 'admin' || currentUser?.userType === 'user') && (
                            <div className="text-center py-6">
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                                <p className="text-yellow-700 font-medium">Nenhum motorista vinculado</p>
                                <p className="text-yellow-600 text-sm mt-1">
                                  Vincule um motorista para começar o rastreamento
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                                  {/* <Button
                                    size="sm"
                                    onClick={() => openSelectDriverModal(firstFreight)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                  <UserCheck className="w-4 h-4 mr-1" />
                                    Vincular Motorista Existente
                                  </Button> */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDriverModal(firstFreight)}
                                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                  >
                                  <UserPlus className="w-4 h-4 mr-1" />
                                    Cadastrar/Vincular Novo Motorista
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ✅ SEMPRE MOSTRAR: Histórico de Rastreamento */}
                          {firstFreight.trackingHistory && firstFreight.trackingHistory.length > 0 && (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-orange-500" />
                                Histórico de Rastreamento
                              </h3>
                              <TrackingTimeline history={firstFreight.trackingHistory} />
                            </div>
                          )}

                          {/* Carrier View */}
                          {currentUser?.userType === 'carrier' && (
                            <div className="space-y-6">
                              {/* Carrier Financial Info */}
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                  <div className="text-xs text-gray-500">Sua Proposta Inicial</div>
                                  <div className="text-2xl font-bold text-blue-600 mt-1">
                                    R$ { (firstFreight.carrierProposals?.[currentUser.carrierName] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
                                  </div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                  <div className="text-xs text-gray-500">Valor Final Contratado</div>
                                  <div className="2xl font-bold text-green-600 mt-1">
                                    R$ {firstFreight.finalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                  </div>
                                </div>
                              </div>

                              {/* Main Layout: Image (no interactive map or detailed route info for carriers here) */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* LEFT COLUMN: Map Image */}
                                <div className="bg-gray-50 rounded-lg p-4 border col-span-2"> {/* Take full width if no other column */}
                                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                    <Map className="w-5 h-5 mr-2 text-blue-600" /> Mapa da Rota
                                  </h4>
                                  {firstFreight.mapImage ? (
                                    <img
                                      src={firstFreight.mapImage}
                                      alt="Mapa da Rota"
                                      className="w-full h-auto max-h-96 object-contain rounded-lg border cursor-pointer"
                                      onClick={() => { setCurrentImagePreview(firstFreight.mapImage); setShowImageModal(true); }}
                                    />
                                  ) : <p className="text-gray-500 text-center p-8">Imagem não disponível.</p>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Admin/User View */}
                          {(currentUser?.userType === 'admin' || currentUser?.userType === 'user') && (
                            <div className="space-y-6">
                              {/* Full Financial Summary for Admin/User */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                <div className="bg-gray-100 rounded-lg p-3 border">
                                  <div className="text-xs text-gray-500">Valor do Mapa</div>
                                  <div className="xl font-bold text-gray-800 mt-1">
                                    R$ {firstFreight.mapValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                                {(() => {
                                  const allProposalsForThisMapNumber = allFreightMaps
                                    .filter(map => map.mapNumber === firstFreight.mapNumber)
                                    .flatMap(map => map.carrierProposals ? Object.values(map.carrierProposals) : [])
                                    .filter(value => typeof value === 'number' && value > 0);

                                  const totalPropostas = allProposalsForThisMapNumber.length;
                                  const menorProposta = totalPropostas > 0 ? Math.min(...allProposalsForThisMapNumber) : 0;
                                  const maiorProposta = totalPropostas > 0 ? Math.max(...allProposalsForThisMapNumber) : 0;

                                  return (
                                    <>
                                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                        <div className="text-xs text-gray-500">Menor Proposta</div>
                                        <div className="xl font-bold text-blue-600 mt-1">
                                          {menorProposta ? `R$ ${menorProposta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                        </div>
                                      </div>
                                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                        <div className="text-xs text-gray-500">Maior Proposta</div>
                                        <div className="xl font-bold text-purple-600 mt-1">
                                          {maiorProposta ? `R$ ${maiorProposta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
                                        </div>
                                      </div>
                                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                        <div className="text-xs text-gray-500">Total Propostas</div>
                                        <div className="xl font-bold text-orange-600 mt-1">{totalPropostas}</div>
                                      </div>
                                      <div className="bg-green-50 rounded-lg p-3 border border-green-200 col-span-2 md:col-span-1">
                                        <div className="text-xs text-gray-500">Valor Final</div>
                                        <div className="xl font-bold text-green-600 mt-1">
                                          R$ {firstFreight.finalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Detalhes Financeiros */}
                              <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                                  Detalhes Financeiros
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-gray-600">Valor Inicial da Proposta:</span>
                                    <p className="font-bold text-lg text-red-600 line-through">
                                      R$ ${(firstFreight.carrierProposals?.[firstFreight.selectedCarrier] || firstFreight.finalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Valor Final Contratado:</span>
                                    <p className="font-bold text-lg text-green-700">
                                      R$ ${(firstFreight.finalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>

                                {(() => {
                                  const initialProposal = firstFreight.carrierProposals?.[firstFreight.selectedCarrier] || firstFreight.finalValue || 0;
                                  const finalValue = firstFreight.finalValue || 0;
                                  const savings = initialProposal - finalValue;

                                  if (savings > 0) {
                                    return (
                                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-800">
                                          <strong>💰 Economia obtida:</strong> R$ {savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          {' '}({((savings / initialProposal) * 100).toFixed(1)}% de desconto)
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              {/* Proposals Received for this Map */}
                              {(() => { // Wrap in an IIFE to allow variable declaration
                                const allRelevantProposalsMaps = allFreightMaps.filter(
                                  map => map.mapNumber === firstFreight.mapNumber &&
                                  map.carrierProposals &&
                                  Object.keys(map.carrierProposals).length > 0
                                );
                                if (allRelevantProposalsMaps.length > 0) {
                                  return (
                                    <div>
                                      <h4 className="font-semibold text-gray-700 mb-2">Propostas Recebidas (Mapa {firstFreight.mapNumber})</h4>
                                      <div className="bg-gray-50 rounded-lg p-4 border max-h-60 overflow-y-auto">
                                        <div className="space-y-3">
                                          {allRelevantProposalsMaps.flatMap(freightMap =>
                                            Object.entries(freightMap.carrierProposals).map(([carrier, proposal]) => (
                                              <div key={`${freightMap.id}-${carrier}`} className="flex justify-between items-center bg-white p-2 rounded border">
                                                <span className="font-medium text-sm text-gray-800 flex items-center">
                                                  {carrier}
                                                  {carrier === firstFreight.selectedCarrier && (
                                                    <Badge className="ml-2 bg-green-600 text-white text-xs">CONTRATADO</Badge>
                                                  )}
                                                </span>
                                                <Badge className={proposal === Math.min(...Object.values(freightMap.carrierProposals).filter(v => typeof v === 'number')) ? 'bg-green-600 text-white' : ''}>
                                                  R$ {proposal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </Badge>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Managers Info */}
                              {firstFreight.managers?.length > 0 && (
                                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                    <Users className="w-5 h-5 mr-2 text-teal-600" />
                                    Gerentes Associados
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {firstFreight.managers.map((m, i) => (
                                      <div key={i} className="bg-white p-2 rounded border">
                                        <p className="font-medium text-gray-700">{m.gerente}</p>
                                        <p className="text-sm text-teal-700 font-semibold">R$ {parseFloat(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Display finalization observations if they exist */}
                              {firstFreight.finalizationObservation && (
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <h5 className="font-semibold text-blue-800 mb-2">📝 Observações da Finalização:</h5>
                                  <p className="text-sm text-gray-700 italic">"{firstFreight.finalizationObservation}"</p>
                                </div>
                              )}

                              {/* Button to show additional details (History and Justification) */}
                              <div className="text-center mt-4">
                                <Button variant="outline" onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}>
                                  {isDetailsExpanded ? 'Ocultar' : 'Exibir'} Histórico e Justificativas <ChevronDown className={`inline-block w-4 h-4 ml-1 transition-transform ${isDetailsExpanded ? 'rotate-180' : ''}`} />
                                </Button>
                              </div>

                              {isDetailsExpanded && (
                                <div className="border-t pt-6 mt-6 space-y-6">
                                  {/* History and Justification */}
                                  <div className="space-y-4">
                                    {firstFreight.justification && (
                                      <div>
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Justificativa da Escolha</p>
                                        <p className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-200">{firstFreight.justification}</p>
                                      </div>
                                    )}
                                    {firstFreight.editObservations && firstFreight.editObservations.length > 0 && (
                                      <div>
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Histórico de Edições</p>
                                        <div className="space-y-2">
                                          {firstFreight.editObservations.map((obs, i) => (
                                            <div key={i} className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                              <p className="font-semibold">{obs.details}</p>
                                              <p className="italic">"{obs.observation}"</p>
                                              <p className="text-xs text-gray-500 mt-1"> - {format(new Date(obs.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR })} por {obs.user}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* ✅ INÍCIO DA SEÇÃO ATUALIZADA: Progresso da Entrega e Detalhes da Rota, e Status das Entregas */}
                              {firstFreight.routeData && (
                                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                                    <Route className="w-5 h-5 mr-2" />
                                    Progresso da Entrega e Detalhes da Rota
                                  </h4>
                                  <div className="mb-4">
                                    <RouteDetails routeData={firstFreight.routeData} />
                                  </div>
                                  <div className="mb-4">
                                    <RouteStopsDisplay
                                      routeData={firstFreight.routeData}
                                      currentUser={currentUser}
                                      deliveredStops={firstFreight.deliveredStops || []}
                                      map={firstFreight}
                                    />
                                  </div>
                                  <div className="mt-6">
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                      <Map className="w-5 h-5 mr-2" />
                                      Mapa da Rota (Coordenadas)
                                    </h4>
                                    <RouteMapComponent
                                      origin={firstFreight.routeData.origin?.coordinates}
                                      destination={firstFreight.routeData.destination?.coordinates}
                                      route={firstFreight.routeData.routes?.economic} // Mostra a rota econômica como padrão
                                      waypoints={firstFreight.routeData.waypoints}
                                      height="300px"
                                    />
                                  </div>

                                  {/* ✅ NOVO: Exibição detalhada do status das paradas */}
                                  <div className="mt-4">
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                      <MapPin className="w-5 h-5 mr-2 text-indigo-500" />
                                      Status das Entregas
                                    </h4>
                                    <div className="space-y-2">
                                      {(() => {
                                        const stopsToDisplay = (firstFreight.routeData.waypoints || []).map(wp => ({
                                          identifier: wp.name.includes(': ') ? wp.name.split(': ')[1] : wp.name,
                                          originalWaypoint: wp
                                        }));
                                        stopsToDisplay.push({
                                          identifier: firstFreight.destination,
                                          originalWaypoint: { name: `Destino: ${firstFreight.destination}`, coordinates: firstFreight.routeData?.destination?.coordinates }
                                        });

                                        return stopsToDisplay.map((stop, index) => {
                                          const isDelivered = (firstFreight.deliveredStops || []).includes(stop.identifier);
                                          const isFailed = (firstFreight.failedStops || []).includes(stop.identifier);
                                          
                                          let failureReason = null;
                                          if (isFailed) {
                                            const failureOccurrence = (firstFreight.occurrences || []).find(
                                              occ => occ.description.includes(`Falha na entrega em ${stop.identifier}`)
                                            );
                                            if (failureOccurrence) {
                                              // ✅ CORREÇÃO: Usar failureOccurrence em vez de occurrence
                                              failureReason = failureOccurrence.description.split('Justificativa: ')[1] || failureOccurrence.description;
                                            }
                                          }

                                          return (
                                            <div key={index} className={`p-3 rounded-lg border ${
                                              isDelivered ? 'bg-green-50 border-green-200' :
                                              isFailed ? 'bg-red-50 border-red-200' :
                                              'bg-gray-50 border-gray-200'
                                            }`}>
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                  {isDelivered ? <CheckCircle className="w-5 h-5 mr-3 text-green-600" /> :
                                                   isFailed ? <XCircle className="w-5 h-5 mr-3 text-red-600" /> :
                                                   <div className="w-5 h-5 mr-3 flex items-center justify-center"><div className="w-2 h-2 bg-gray-400 rounded-full"></div></div>
                                                  }
                                                  <span className="font-medium text-gray-800">{stop.identifier}</span>
                                                </div>
                                                {isDelivered && <Badge variant="outline" className="text-green-700 border-green-300">Entregue</Badge>}
                                                {isFailed && <Badge variant="destructive" className="bg-red-600 text-white">Falhou</Badge>}
                                                {!isDelivered && !isFailed && <Badge variant="outline">Pendente</Badge>}
                                              </div>
                                              {isFailed && failureReason && (
                                                <div className="mt-2 pl-8 text-sm text-red-800">
                                                  <strong>Motivo:</strong> {failureReason}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      })()}
                                    </div>
                                  </div>

                                </div>
                              )}
                              {/* ✅ FIM DA SEÇÃO ATUALIZADA */}

                              {/* ✅ NOVA SEÇÃO: Ocorrências do Motorista */}
                              <div className="border-t pt-6 mt-6">
                                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-orange-800 flex items-center">
                                      <AlertTriangle className="w-5 h-5 mr-2" />
                                      Ocorrências do Transporte
                                    </h4>
                                    {((firstFreight.occurrences && firstFreight.occurrences.length > 0) ||
                                      (firstFreight.occurrenceImages && firstFreight.occurrenceImages.length > 0)) && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsOccurrencesExpanded(!isOccurrencesExpanded)}
                                        className="text-orange-700 hover:bg-orange-100"
                                      >
                                        {isOccurrencesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        {isOccurrencesExpanded ? 'Recolher' : 'Expandir'}
                                      </Button>
                                    )}
                                  </div>

                                  {/* Resumo das Ocorrências */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-white rounded-lg p-3 border border-orange-100">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-orange-600">
                                          {firstFreight.occurrences ? firstFreight.occurrences.length : 0}
                                        </p>
                                        <p className="text-sm text-gray-600">Ocorrências Relatadas</p>
                                      </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-orange-100">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-blue-600">
                                          {firstFreight.occurrenceImages ? firstFreight.occurrenceImages.length : 0}
                                        </p>
                                        <p className="text-sm text-gray-600">Fotos Anexadas</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Conteúdo Expandido das Ocorrências */}
                                  {isOccurrencesExpanded && (
                                    <div className="space-y-4">
                                      {/* Ocorrências de Texto */}
                                      {firstFreight.occurrences && firstFreight.occurrences.length > 0 && (
                                        <div>
                                          <h5 className="font-medium text-gray-800 mb-3 flex items-center">
                                            <FileText className="w-4 h-4 mr-2 text-orange-600" />
                                            Relatos de Ocorrências
                                          </h5>
                                          <div className="space-y-3">
                                            {firstFreight.occurrences.map((occurrence, index) => (
                                              <div key={index} className="bg-white border border-orange-200 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                  <span className="text-xs text-gray-500 flex items-center">
                                                    <UserCircle className="w-3 h-3 mr-1" />
                                                    {occurrence.user || 'Motorista'}
                                                  </span>
                                                  <span className="text-xs text-gray-500 flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    {occurrence.timestamp ?
                                                      formatToBrazilTime(occurrence.timestamp) :
                                                      'Data não disponível'
                                                    }
                                                  </span>
                                                </div>
                                                <p className="text-gray-800 text-sm leading-relaxed">
                                                  {occurrence.description}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Imagens de Ocorrências */}
                                      {firstFreight.occurrenceImages && firstFreight.occurrenceImages.length > 0 && (
                                        <div>
                                          <h5 className="font-medium text-gray-800 mb-3 flex items-center">
                                            <ZoomIn className="w-4 h-4 mr-2 text-blue-600" />
                                            Fotos das Ocorrências
                                          </h5>
                                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {firstFreight.occurrenceImages.map((image, index) => (
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
                                                </div>
                                                <div className="mt-2 text-center">
                                                  <p className="text-xs text-gray-600 truncate">
                                                    {image.name || `Foto ${index + 1}`}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    {image.uploadedAt ?
                                                      formatDate(image.uploadedAt) :
                                                      'Data não disponível'
                                                    }
                                                  </p>
                                                  <p className="text-xs text-gray-400">
                                                    por {image.uploadedBy || 'Motorista'}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Mensagem quando não há ocorrências */}
                                      {(!firstFreight.occurrences || firstFreight.occurrences.length === 0) &&
                                       (!firstFreight.occurrenceImages || firstFreight.occurrenceImages.length === 0) && (
                                        <div className="text-center py-8">
                                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                          <p className="text-gray-600 font-medium">Nenhuma ocorrência relatada</p>
                                          <p className="text-sm text-gray-500">O transporte está ocorrendo sem problemas</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Mostrar apenas um preview quando recolhido */}
                                {!isOccurrencesExpanded &&
                                ((firstFreight.occurrences && firstFreight.occurrences.length > 0) ||
                                  (firstFreight.occurrenceImages && firstFreight.occurrenceImages.length > 0)) && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                                    <p className="text-sm text-yellow-800">
                                      Há {(firstFreight.occurrences?.length || 0) + (firstFreight.occurrenceImages?.length || 0)}
                                      {' '}ocorrência{((firstFreight.occurrences?.length || 0) + (firstFreight.occurrenceImages?.length || 0)) > 1 ? 's' : ''}
                                      {' '}registrada{((firstFreight.occurrences?.length || 0) + (firstFreight.occurrenceImages?.length || 0)) > 1 ? 's' : ''}.
                                      Clique em "Expandir" para ver os detalhes.
                                    </p>
                                  </div>
                                )}

                                {/* Quando não há ocorrências - Mostrar sempre */}
                                {(!firstFreight.occurrences || firstFreight.occurrences.length === 0) &&
                                (!firstFreight.occurrenceImages || firstFreight.occurrenceImages.length === 0) && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                    <p className="text-sm text-green-800 flex items-center justify-center">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Transporte sem ocorrências registradas
                                    </p>
                                  </div>
                                )}
                            </div>
                          )}

                          {/* ✅ CORREÇÃO: Substituir "Roteiro Detalhado" pela imagem do mapa para admin/user */}
                          {/* This is for Admin/User to see the static map image if available */}
                          {firstFreight.mapImage && (currentUser?.userType === 'admin' || currentUser?.userType === 'user') && (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                                <Map className="w-5 h-5 mr-2 text-indigo-500" />
                                Mapa da Rota (Imagem)
                              </h3>
                              <div className="text-center">
                                <img
                                  src={firstFreight.mapImage}
                                  alt="Mapa da Rota"
                                  className="w-full max-h-96 object-contain rounded-lg border cursor-pointer hover:shadow-lg transition-shadow"
                                  onClick={() => {
                                    setCurrentImagePreview(firstFreight.mapImage);
                                    setShowImageModal(true);
                                  }}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                  Clique na imagem para visualizar em tamanho completo
                                </p>
                              </div>
                            </div>
                          )}

                          {/* ✅ MOSTRAR APENAS PARA NÃO-TRANSPORTADORAS: Anexos/Documentos */}
                          {(currentUser?.userType === 'admin' || currentUser?.userType === 'user') && (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <Paperclip className="w-5 h-5 mr-2 text-green-500" />
                                Documentos e Anexos
                              </h3>

                              {allGroupAttachments && allGroupAttachments.length > 0 ? (
                                <div className="grid gap-3">
                                  {allGroupAttachments.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                      <div className="flex items-center">
                                        <FileText className="w-5 h-5 mr-3 text-blue-600" />
                                        <div>
                                          <a
                                            href={item.invoice.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                            onClick={() => handleDownload(item.freightMapId, item.invoice)}
                                          >
                                            {item.invoice.name}
                                          </a>
                                          <p className="text-xs text-gray-500">
                                            Anexado em {format(new Date(item.invoice.uploadedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })} por {' '}
                                            <span className={`font-semibold px-2 py-1 rounded-full text-xs ${
                                              item.invoice.uploadedBy?.includes('@')
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-orange-100 text-orange-800'
                                            }`}>
                                              {item.invoice.uploadedBy || 'Sistema'}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                      {/* Delete button: logic remains the same (allow carrier if it's their freight, otherwise admin/user) */}
                                      {(currentUser?.userType !== 'carrier' || (currentUser?.userType === 'carrier' && item.freightMapId === firstFreight.id && firstFreight.selectedCarrier === currentUser.carrierName)) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteFile(item.freightMapId, item.invoice.url)}
                                          className="text-red-500 hover:bg-red-100"
                                          title="Remover arquivo"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-6 text-gray-500">
                                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                  <p>Nenhum documento anexado ainda</p>
                                  <p className="text-sm">Documentos serão exibidos aqui quando enviados pela transportadora</p>
                                </div>
                              )}

                              {/* File Upload Section for Admin/User (and relevant Carriers) */}
                              {(currentUser?.userType !== 'carrier' || (currentUser?.userType === 'carrier' && firstFreight.selectedCarrier === currentUser.carrierName)) && ( // This condition applies to the upload button
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <h5 className="font-semibold text-gray-800 mb-3">
                                    📎 Anexar Documentos do Frete
                                  </h5>
                                  <div className="relative">
                                    <input
                                      type="file"
                                      multiple
                                      accept=".pdf,.xml,.jpg,.jpeg,.png,.doc,.docx"
                                      onChange={(e) => handleFileUpload(e, firstFreight.id)}
                                      disabled={uploadingFiles[firstFreight.id]}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      id={`file-upload-${firstFreight.id}`}
                                    />
                                    <label
                                      htmlFor={`file-upload-${firstFreight.id}`}
                                      className={`w-full flex items-center justify-center p-3 border border-blue-300 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors ${uploadingFiles[firstFreight.id] ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                      {uploadingFiles[firstFreight.id] ? (
                                        <div className="flex items-center">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                          Enviando...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <Upload className="w-4 h-4 mr-2" />
                                          Clique para selecionar arquivos ou arraste aqui
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2 text-center">
                                    Formatos suportados: PDF, XML, JPG, PNG, DOC, DOCX (máx. 10MB cada)
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
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
                    // Show up to 5 pages: current, 2 before and 2 after
                    const maxPagesToShow = 5;
                    const half = Math.floor(maxPagesToShow / 2);
                    if (paginationData.totalPages <= maxPagesToShow) {
                      return true; // Show all pages if total pages are less than or equal to 5
                    }
                    if (currentPage <= half) {
                      return page <= maxPagesToShow; // Show first 5 pages
                    }
                    if (currentPage > paginationData.totalPages - half) {
                      return page > paginationData.totalPages - maxPagesToShow; // Show last 5 pages
                    }
                    return Math.abs(page - currentPage) <= half; // Show current page + half on each side
                  })
                  .map(page => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={page === currentPage ? "bg-green-600 text-white" : ""}
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

      {/* NEW MODAL: Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Edit className="w-6 h-6 mr-2 text-blue-600" />
              Editar Frete - Mapa {editingFreight?.mapNumber}
            </DialogTitle>
          </DialogHeader>

          {editingFreight && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 my-4">
              <h4 className="font-semibold text-yellow-800 mb-4 flex items-center">
                <Edit className="w-5 h-5 mr-2" />
                Editando Frete Contratado - Mapa {editingFreight.mapNumber}
              </h4>

              <div className="space-y-6">
                {/* Identification */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Identificação</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-mapNumber">Número do Mapa</Label>
                      <Input
                        id="edit-mapNumber"
                        value={editingFreight.mapNumber || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, mapNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-loadingMode">Modalidade</Label>
                      <Select value={editingFreight.loadingMode || ''} onValueChange={(value) => setEditingFreight(prev => ({ ...prev, loadingMode: value, truckType: '' }))}>
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

                {/* Map Image */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Imagem do Mapa</h5>
                  {!editingFreight.mapImage ? (
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
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
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
                        src={editingFreight.mapImage}
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

                {/* Route */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Informações da Rota</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-origin">Origem</Label>
                      <Input
                        id="edit-origin"
                        value={editingFreight.origin || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, origin: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-destination">Destino</Label>
                      <Input
                        id="edit-destination"
                        value={editingFreight.destination || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, destination: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-totalKm">Distância (km)</Label>
                      <Input
                        id="edit-totalKm"
                        type="number"
                        value={editingFreight.totalKm || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, totalKm: parseInt(e.target.value) || 0 }))}
                        onWheel={(e) => e.target.blur()}
                      />
                    </div>
                  </div>
                </div>

                {/* Load and Values */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Carga e Valores</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-weight">Peso (kg)</Label>
                      <Input
                        id="edit-weight"
                        type="number"
                        step="0.01"
                        value={editingFreight.weight || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                        onWheel={(e) => e.target.blur()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-mapValue">Valor do Mapa (R$)</Label>
                      <Input
                        id="edit-mapValue"
                        type="number"
                        step="0.01"
                        value={editingFreight.mapValue || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, mapValue: parseFloat(e.target.value) || 0 }))}
                        onWheel={(e) => e.target.blur()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-finalValue">Valor Final Contratado (R$)</Label>
                      <Input
                        id="edit-finalValue"
                        type="number"
                        step="0.01"
                        value={editingFreight.finalValue || ''}
                        onChange={(e) => setEditingFreight(prev => ({ ...prev, finalValue: parseFloat(e.target.value) || 0 }))}
                        className="font-semibold border-green-300"
                        onWheel={(e) => e.target.blur()}
                      />
                    </div>
                  </div>
                </div>

                {/* Transport */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Informações de Transporte</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="edit-selectedCarrier">Transportadora Contratada</Label>
                      <Select value={editingFreight.selectedCarrier || ''} onValueChange={(value) => setEditingFreight(prev => ({ ...prev, selectedCarrier: value }))}>
                        <SelectTrigger id="edit-selectedCarrier">
                          <SelectValue placeholder="Selecione a transportadora" />
                        </SelectTrigger>
                        <SelectContent>
                          {carriers.filter(c => c.active).map(carrier => (
                            <SelectItem key={carrier.id} value={carrier.name}>
                              🚛 {carrier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-truckType">Tipo de Caminhão</Label>
                      <Select value={editingFreight.truckType || ''} onValueChange={(value) => setEditingFreight(prev => ({ ...prev, truckType: value }))}>
                        <SelectTrigger id="edit-truckType">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredTruckTypes(editingFreight.loadingMode).map(truck => (
                            <SelectItem key={truck.id} value={truck.name}>
                              {truck.name} ({truck.capacity}t)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-loadingDate">Data de Carregamento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {editingFreight.loadingDate ? format(editingFreight.loadingDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={editingFreight.loadingDate}
                          onSelect={(date) => setEditingFreight(prev => ({ ...prev, loadingDate: date }))}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Observations */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h5 className="font-medium text-gray-800 mb-3">Informações da Rota/Observações Adicionais</h5>
                  <Textarea
                    placeholder="Informações adicionais sobre a rota..."
                    value={editingFreight.routeInfo || ''}
                    onChange={(e) => setEditingFreight(prev => ({ ...prev, routeInfo: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Edit Observation */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <Label htmlFor="edit-observation">Observação da Edição *</Label>
                  <p className="text-sm text-orange-700 mb-2">Obrigatória se alterar transportadora, valor do mapa ou valor final.</p>
                  <Textarea
                    id="edit-observation"
                    placeholder="Descreva o motivo das alterações..."
                    value={editObservation}
                    onChange={(e) => setEditObservation(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              <Ban className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal (for Edit Form's image) - KEPT GLOBAL */}
      {showImagePreview && editingFreight?.mapImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl max-h-full">
            <Button
              onClick={() => setShowImagePreview(false)}
              className="absolute -top-4 -right-4 bg-white text-gray-800 hover:bg-gray-100 rounded-full p-3 shadow-lg z-10"
            >
              <X className="w-6 h-6" />
            </Button>
            <img
              src={editingFreight.mapImage}
              alt="Preview da Imagem"
              className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* NEW MODAL: Reopen Negotiation (UPDATED) */}
      <Dialog open={!!reopeningFreight} onOpenChange={() => setReopeningFreight(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reabrir Frete para Negociação</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Informações do Frete</h4>
              <div className="space-y-1 text-sm text-blue-700">
                <p><strong>Mapa:</strong> {reopeningFreight?.mapNumber}</p>
                <p><strong>Transportadora:</strong> {reopeningFreight?.selectedCarrier}</p>
                <p><strong>Rota:</strong> {reopeningFreight?.origin} → {reopeningFreight?.destination}</p>
                <p><strong>Valor Final:</strong> R$ {reopeningFreight?.finalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Atenção!</p>
                  <p>Esta ação irá retornar o frete para a página de negociação e permitirá um novo acordo de valores.</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="reopen-justification" className="text-sm font-medium text-gray-700">
                Justificativa para Reabertura *
              </Label>
              <Textarea
                id="reopen-justification"
                value={reopenJustification}
                onChange={(e) => setReopenJustification(e.target.value)}
                placeholder="Descreva o motivo para reabrir este frete..."
                className="mt-2"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                Campo obrigatório. ({reopenJustification.trim().length}/500)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReopeningFreight(null);
                setReopenJustification('');
              }}
              disabled={isReopening}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReopenNegotiation}
              disabled={isReopening || !reopenJustification.trim() || reopenJustification.trim().length < 10}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isReopening ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Reabrindo...
                </>
              ) : (
                <>
                  <ArrowLeftCircle className="w-4 h-4 mr-2" />
                  Confirmar e Reabrir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal (for route image) */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 flex items-center justify-center bg-transparent border-none shadow-none">
          <img
            src={currentImagePreview}
            alt="Preview da Imagem do Mapa"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </DialogContent>
      </Dialog>

      {/* ✅ NOVO MODAL: Cadastro de Motorista */}
      {showDriverModal && (
        <DriverModal
          isOpen={showDriverModal}
          onClose={() => {
            setShowDriverModal(false);
            setSelectedMapForDriver(null);
          }}
          mapNumber={selectedMapForDriver?.mapNumber}
          carrierName={selectedMapForDriver?.selectedCarrier}
          onDriverAssigned={handleDriverAssigned}
        />
      )}

      {/* ✅ NOVO MODAL: Modal de seleção de motorista */}
      {showSelectDriverModal && (
        <SelectDriverModal
          isOpen={showSelectDriverModal}
          onClose={() => setShowSelectDriverModal(false)}
          // Filter drivers to only show active ones from the same carrier and not assigned
          drivers={allDrivers.filter(d => d.carrierName === selectedMapForDriver?.selectedCarrier && d.active && !d.assignedMapNumber)}
          onSelectDriver={handleSelectDriver}
        />
      )}
    </div>
  );
}
