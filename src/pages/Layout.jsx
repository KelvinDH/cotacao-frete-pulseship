import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Truck, FileText, HandshakeIcon, CheckCircle, BarChart, UserCircle, Settings, LogOut, User as UserIconSolid, Package, Building, BarChart2, BarChart4, Menu, X } from "lucide-react";
import { User, FreightMap } from "@/components/ApiDatabase";
import { BarChart as BarChartIconLucide }
from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import RouteGuard from '../components/RouteGuard';

export default function Layout({ children, currentPageName }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  // ✅ NOVOS ESTADOS PARA NOTIFICAÇÃO DE CONTRATADOS (anexos para admin/user)
  const [contractedNotificationCount, setContractedNotificationCount] = useState(0);
  const [lastReadContractedTimestamp, setLastReadContractedTimestamp] = useState(null);
  // ✅ NOVOS ESTADOS PARA NOTIFICAÇÃO DE FRETE CONTRATADO PARA TRANSPORTADORA
  const [carrierWinNotificationCount, setCarrierWinNotificationCount] = useState(0);
  const [lastReadCarrierWinTimestamp, setLastReadCarrierWinTimestamp] = useState(null);
  // ✅ NOVO ESTADO PARA CONTROLE DO MENU LATERAL
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);


  useEffect(() => {
    loadUser();
  }, []);

  // Efeito para carregar o timestamp do localStorage QUANDO o usuário muda.
  useEffect(() => {
    if (currentUser) {
      // Timestamp para Negociação
      const storedNegotiationTimestamp = localStorage.getItem(`lastRead_${currentUser.userType}_${currentUser.id}`);
      setLastReadTimestamp(storedNegotiationTimestamp ? new Date(storedNegotiationTimestamp) : new Date(0));

      // Timestamp para Contratados (anexos para admin/user)
      if (currentUser.userType === 'admin' || currentUser.userType === 'user') {
        const storedContractedTimestamp = localStorage.getItem(`lastReadContracted_${currentUser.id}`);
        setLastReadContractedTimestamp(storedContractedTimestamp ? new Date(storedContractedTimestamp) : new Date(0));
      } else {
        // Limpa para transportadoras, pois esta notificação não é para elas
        setLastReadContractedTimestamp(null); 
      }

      // ✅ NOVO: Timestamp para fretes ganhos (apenas para carrier)
      if (currentUser.userType === 'carrier') {
        const storedCarrierWinTimestamp = localStorage.getItem(`lastReadCarrierWin_${currentUser.id}`);
        setLastReadCarrierWinTimestamp(storedCarrierWinTimestamp ? new Date(storedCarrierWinTimestamp) : new Date(0));
      } else {
        // Limpa para outros tipos de usuário, pois esta notificação não é para eles
        setLastReadCarrierWinTimestamp(null);
      }
    } else {
      setLastReadTimestamp(null);
      setLastReadContractedTimestamp(null);
      setLastReadCarrierWinTimestamp(null); // Limpa ao deslogar
    }
  }, [currentUser]);

  // Função para converter data/hora para horário de Brasília
  const toBrazilDateTime = (dateString) => {
    if (!dateString) return new Date();
    // Convert the input date string to a Date object assuming it's UTC or local.
    const date = new Date(dateString);
    // Use toLocaleString with timeZone option to get a string representation in the desired timezone.
    // Then create a new Date object from this localized string.
    // This is a common workaround to get a Date object that internally represents the time in the specified timezone,
    // though the Date object itself is always in UTC internally. The key is how it's *interpreted* for comparisons.
    // A more robust approach might involve library like `date-fns-tz` or `moment-timezone` for complex manipulations.
    // For simple comparison like `>` on `Date` objects, ensuring both are treated consistently (e.g., as UTC or relative to a fixed epoch) is what matters.
    // Here, we ensure that `mapCreatedAt` and `mapUpdatedAt` are interpreted as Brazil time before comparison.
    return new Date(date.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  };

  // Efeito para buscar notificações de NEGOCIAÇÃO
  useEffect(() => {
    if (!currentUser || lastReadTimestamp === null) { // Aguarda até o lastReadTimestamp ser inicializado
      setNotificationCount(0);
      return;
    }

    const fetchNotifications = async () => {
      try {
        let count = 0;
        const readTimestamp = lastReadTimestamp;

        if (currentUser.userType === 'carrier') {
          const negotiatingMaps = await FreightMap.filter({
            status: 'negotiating',
            selectedCarrier: currentUser.carrierName,
          });
          count = negotiatingMaps.filter(map => {
            const hasProposal = map.carrierProposals && map.carrierProposals[currentUser.carrierName];
            const mapCreatedAt = toBrazilDateTime(map.created_date);
            return !hasProposal && mapCreatedAt > readTimestamp;
          }).length;
        } else { // Admin ou User
          const negotiatingMaps = await FreightMap.filter({ status: 'negotiating' });
          count = negotiatingMaps.filter(map => {
            if (!map.carrierProposals || Object.keys(map.carrierProposals).length === 0) {
              return false;
            }
            const mapUpdatedAt = toBrazilDateTime(map.updated_date || map.created_date);
            return mapUpdatedAt > readTimestamp;
          }).length;
        }
        setNotificationCount(count);
      } catch (error) {
        console.error("Erro ao buscar notificações:", error);
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [currentUser, lastReadTimestamp]);

  // EFEITO: Buscar notificações de CONTRATADOS (anexos para admin/user)
  useEffect(() => {
    // Roda apenas para admin/user e quando o timestamp estiver carregado
    if (!currentUser || (currentUser.userType !== 'admin' && currentUser.userType !== 'user') || lastReadContractedTimestamp === null) {
      setContractedNotificationCount(0);
      return;
    }

    const fetchContractedNotifications = async () => {
      try {
        const contractedFreights = await FreightMap.filter({ status: 'contracted' });
        
        const newUploads = contractedFreights.filter(map => {
          // Verifica se há anexos
          if (!map.invoiceUrls || map.invoiceUrls.length === 0) {
            return false;
          }
          // Encontra o anexo mais recente
          // Nota: Assumimos que cada invoiceUrl object tem uma propriedade `uploadedAt`
          const latestInvoice = map.invoiceUrls.reduce((latest, current) => 
            new Date(current.uploadedAt) > new Date(latest.uploadedAt) ? current : latest
          );
          // Compara a data do anexo mais recente com a data da última leitura
          const uploadDate = toBrazilDateTime(latestInvoice.uploadedAt);
          return uploadDate > lastReadContractedTimestamp;
        });

        setContractedNotificationCount(newUploads.length);
      } catch (error) {
        console.error("Erro ao buscar notificações de contratados:", error);
      }
    };
    
    fetchContractedNotifications();
    const interval = setInterval(fetchContractedNotifications, 30000); // Verifica a cada 30s

    return () => clearInterval(interval);
  }, [currentUser, lastReadContractedTimestamp, toBrazilDateTime]); // `toBrazilDateTime` is stable, but adding it explicitly is harmless.

  // ✅ NOVO EFEITO: Buscar notificações de FRETE GANHO (para transportadora)
  useEffect(() => {
    if (!currentUser || currentUser.userType !== 'carrier' || lastReadCarrierWinTimestamp === null) {
      setCarrierWinNotificationCount(0);
      return;
    }

    const fetchWinNotifications = async () => {
      try {
        const contractedFreights = await FreightMap.filter({ 
          status: 'contracted',
          selectedCarrier: currentUser.carrierName,
        });
        
        const newWins = contractedFreights.filter(map => {
          if (!map.contractedAt) return false; // Ensure 'contractedAt' field exists
          const contractedDate = toBrazilDateTime(map.contractedAt);
          return contractedDate > lastReadCarrierWinTimestamp;
        });

        setCarrierWinNotificationCount(newWins.length);
      } catch (error) {
        console.error("Erro ao buscar notificações de fretes ganhos:", error);
      }
    };

    fetchWinNotifications();
    const interval = setInterval(fetchWinNotifications, 30000);

    return () => clearInterval(interval);
  }, [currentUser, lastReadCarrierWinTimestamp, toBrazilDateTime]);

  const loadUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (err) {
      console.log("No user authenticated, continuing without auth");
    }
    setLoading(false);
  };

  const simulateLogin = async (userType = 'admin') => {
    try {
      const users = await User.list();
      let user = users.find(u => u.userType === userType);
      
      if (!user) {
        user = await User.create({
          fullName: userType === 'admin' ? 'Administrador Sistema' : (userType === 'carrier' ? 'Transportadora Demo' : (userType === 'driver' ? 'Motorista Demo' : 'Usuário Demo')),
          username: userType,
          email: `${userType}@unionagro.com`,
          password: '123456',
          userType: userType,
          carrierName: userType === 'carrier' ? 'Transportadora Demo' : null,
          active: true
        });
      }
      
      await User.login(user.username, '123456');
      setCurrentUser(user);
      setShowUserModal(false);
    } catch (error) {
      console.error(`Error simulating login: - ${error.message}`);
      if (error.message.includes('está em uso')) {
        const users = await User.list();
        const existingUser = users.find(u => u.username === userType);
        if (existingUser) {
          await User.login(existingUser.username, '123456');
          setCurrentUser(existingUser);
          setShowUserModal(false);
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await User.logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    }
    setCurrentUser(null);
    window.location.href = createPageUrl('Login');
  };

  const getUserTypeInfo = (userType) => {
    switch (userType) {
      case 'admin':
        return { label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200', icon: '' };
      case 'carrier':
        return { label: 'Transportadora', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🚛' };
      case 'driver':
        return { label: 'Motorista', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '🚚' };
      default:
        return { label: 'Usuário', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '👤' };
    }
  };

  // Definir navegação baseada no tipo de usuário
  const getNavigationForUser = (userType) => {
    const baseNavigation = [
      { name: 'Cotação', path: 'Quote', icon: FileText },
      { name: 'Negociação', path: 'Negotiation', icon: HandshakeIcon },
      { name: 'Contratados', path: 'Contracted', icon: CheckCircle },
      { name: 'Relatórios', path: 'Reports', icon: BarChart },
      { name: 'Gráficos', path: 'ChartsPage', icon: BarChart4 },
    ];

    const adminOnlyPages = [
      { name: 'Usuários', path: 'Users', icon: UserCircle },
      { name: 'Tipos Caminhão', path: 'TruckTypes', icon: Truck },
      { name: 'Transportadoras', path: 'Carriers', icon: Building },
    ];

    const carrierPages = [
      { name: 'Negociação', path: 'Negotiation', icon: HandshakeIcon },
      { name: 'Fretes Fechados', path: 'Contracted', icon: Package },
    ];

    // ✅ NOVA NAVEGAÇÃO: Para motoristas
    const driverPages = [
      { name: 'Meus Fretes', path: 'MeusFretes', icon: Truck },
    ];

    switch (userType) {
      case 'admin':
        return [...baseNavigation, ...adminOnlyPages];
      case 'carrier':
        return carrierPages;
      case 'driver':
        return driverPages;
      case 'user':
      default:
        return baseNavigation;
    }
  };

  // Função para marcar as notificações de NEGOCIAÇÃO como lidas
  const markNotificationsAsRead = () => {
    if (!currentUser) return;
    const now = new Date();
    setNotificationCount(0);
    setLastReadTimestamp(now);
    localStorage.setItem(`lastRead_${currentUser.userType}_${currentUser.id}`, now.toISOString());
  };

  // Função: Marcar notificações de CONTRATADOS (anexos) como lidas (para admin/user)
  const markContractedAsRead = () => {
    if (!currentUser || (currentUser.userType !== 'admin' && currentUser.userType !== 'user')) return;
    const now = new Date();
    setContractedNotificationCount(0);
    setLastReadContractedTimestamp(now);
    localStorage.setItem(`lastReadContracted_${currentUser.id}`, now.toISOString());
  };

  // ✅ NOVA FUNÇÃO: Marcar notificações de FRETE GANHO como lidas (para transportadora)
  const markCarrierWinAsRead = () => {
    if (!currentUser || currentUser.userType !== 'carrier') return;
    const now = new Date();
    setCarrierWinNotificationCount(0);
    setLastReadCarrierWinTimestamp(now);
    localStorage.setItem(`lastReadCarrierWin_${currentUser.id}`, now.toISOString());
  };

  // ✅ NOVA FUNÇÃO: Toggle do menu expandido
  const toggleMenuExpanded = () => {
    setIsMenuExpanded(!isMenuExpanded);
  };

  const visibleNavigation = currentUser ? getNavigationForUser(currentUser.userType) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
  <RouteGuard currentPageName={currentPageName}>
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex">
      <style>{`
        :root {
          --primary-color: #008B45;
          --secondary-color: #8BC34A;
          --accent-color: #CDDC39;
          --background-start: #F1F8E9;
          --background-end: #E8F5E9;
          --text-dark: #2c3e50;
          --text-light: #f8fafc;
        }
      `}</style>
      
      {/* ✅ MENU LATERAL FIXO - Apenas ícones */}
      <div className="fixed left-0 top-0 h-full w-16 bg-white shadow-lg border-r border-gray-200 z-40 flex flex-col">
        {/* Botão Hambúrguer */}
        <button
          onClick={toggleMenuExpanded}
          className="w-full h-16 flex items-center justify-center hover:bg-green-50 transition-colors border-b border-gray-200"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        
        {/* Itens de navegação - apenas ícones */}
        <div className="flex-1 py-4">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.path;
            const isNegotiationTab = item.path === 'Negotiation';
            const isContractedTab = item.path === 'Contracted';
            
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                onClick={() => {
                  if (isNegotiationTab) {
                    markNotificationsAsRead();
                  }
                  if (isContractedTab) {
                    // Ação de clique depende do tipo de usuário
                    if (currentUser.userType === 'carrier') {
                      markCarrierWinAsRead();
                    } else {
                      markContractedAsRead();
                    }
                  }
                }}
                className={`relative flex items-center justify-center w-12 h-12 mx-2 my-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                
                {/* Badges de Notificação */}
                {isNegotiationTab && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}

                {isContractedTab && (currentUser.userType === 'admin' || currentUser.userType === 'user') && contractedNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold animate-pulse">
                    {contractedNotificationCount > 9 ? '9+' : contractedNotificationCount}
                  </span>
                )}

                {isContractedTab && currentUser.userType === 'carrier' && carrierWinNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold animate-pulse">
                    {carrierWinNotificationCount > 9 ? '9+' : carrierWinNotificationCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ✅ OVERLAY ESCURO para o menu expandido */}
      {isMenuExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={toggleMenuExpanded}
        />
      )}

      {/* ✅ MENU EXPANDIDO com nomes completos */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isMenuExpanded ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header do menu expandido */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">Menu</h2>
          <button
            onClick={toggleMenuExpanded}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        {/* Itens do menu expandido */}
        <div className="py-4">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.path;
            const isNegotiationTab = item.path === 'Negotiation';
            const isContractedTab = item.path === 'Contracted';
            
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                onClick={() => {
                  if (isNegotiationTab) {
                    markNotificationsAsRead();
                  }
                  if (isContractedTab) {
                    if (currentUser.userType === 'carrier') {
                      markCarrierWinAsRead();
                    } else {
                      markContractedAsRead();
                    }
                  }
                  setIsMenuExpanded(false); // Fecha o menu ao clicar
                }}
                className={`relative flex items-center px-4 py-3 mx-2 my-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.name}</span>
                
                {/* Badges de Notificação no menu expandido */}
                {isNegotiationTab && notificationCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}

                {isContractedTab && (currentUser.userType === 'admin' || currentUser.userType === 'user') && contractedNotificationCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">
                    {contractedNotificationCount > 9 ? '9+' : contractedNotificationCount}
                  </span>
                )}

                {isContractedTab && currentUser.userType === 'carrier' && carrierWinNotificationCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
                    {carrierWinNotificationCount > 9 ? '9+' : carrierWinNotificationCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ✅ CONTEÚDO PRINCIPAL com margem para o menu lateral */}
      <div className="flex-1 ml-16">
        {/* ✅ HEADER PROFISSIONAL REDESENHADO */}
        <div className="bg-gradient-to-r from-white via-gray-50 to-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-5">
            <div className="flex items-center justify-between">
              {/* Logo e Info do Sistema */}
              <div className="flex items-center space-x-6">
                <div className="bg-gradient-to-br from-green-500 via-green-600 to-green-700 p-3 rounded-2xl shadow-lg ring-2 ring-green-100">
                  <UserIconSolid className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PulseShip</h1>
                  <p className="text-sm text-gray-600 font-medium mt-0.5">Sistema de Roteirização de Fretes</p>
                </div>
              </div>

              {/* Info do Usuário */}
              {currentUser ? (
                <div className="flex items-center space-x-8">
                  {/* Dados do usuário */}
                  <div className="text-right">
                    <div className="flex items-center justify-end space-x-3">
                      <div className="text-right">
                        <div className="text-base font-bold text-gray-900">
                          {currentUser.fullName}
                        </div>
                        {currentUser.carrierName && (
                          <div className="text-sm text-blue-600 font-medium -mt-0.5">
                            {currentUser.carrierName}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl">
                        {getUserTypeInfo(currentUser.userType).icon}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end mt-2">
                      <Badge 
                        className={`${getUserTypeInfo(currentUser.userType).color} text-xs px-3 py-1 font-semibold rounded-full`}
                      >
                        {getUserTypeInfo(currentUser.userType).label}
                      </Badge>
                    </div>
                  </div>

                  {/* Divisor vertical elegante */}
                  <div className="h-16 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>

                  {/* Botão de Logout elegante */}
                  <Button 
                    onClick={handleLogout}
                    variant="ghost" 
                    size="lg"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-6 py-3 font-semibold transition-all duration-300 rounded-xl border-2 border-transparent hover:border-red-200 group"
                  >
                    <LogOut className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-300" />
                    Sair
                  </Button>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-lg font-semibold text-gray-600">Acesso Público</span>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* ✅ CONTEÚDO DA PÁGINA */}
          <div className="w-full">
            <div className="bg-white shadow-lg overflow-hidden border-b border-gray-200 min-h-screen">
              {children}
            </div>
            
            <div className="py-6 text-center text-gray-500 text-xs sm:text-sm bg-gray-50">
              <p>© {new Date().getFullYear()} PulseShip - Roteirização de Fretes</p>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}