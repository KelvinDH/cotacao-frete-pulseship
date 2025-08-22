
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Route, Truck, AlertTriangle, Check, Loader2 } from "lucide-react";

export default function RouteStopsDisplay({ routeData, currentUser, deliveredStops = [], map, onUpdateStatus, loadingMapId }) {
    // ✅ ADICIONANDO LOGS DETALHADOS PARA DIAGNÓSTICO
    console.log('🔍 [RouteStopsDisplay] Dados recebidos:', {
        deliveredStops,
        routeData,
        mapNumber: map?.mapNumber
    });

    // Debug: vamos ver o que está chegando
    console.log('🔍 RouteStopsDisplay - routeData recebido:', routeData);
    
    let parsedRouteData = routeData;

    // Checagem de segurança: se routeData for uma string, tenta converter
    if (typeof parsedRouteData === 'string') {
        try {
            parsedRouteData = JSON.parse(parsedRouteData);
            console.log('🔍 RouteStopsDisplay - após parse:', parsedRouteData);
        } catch (e) {
            console.error("Falha ao analisar a string routeData:", e);
            parsedRouteData = null;
        }
    }

    if (!parsedRouteData) {
        console.log('🔍 RouteStopsDisplay - parsedRouteData é null');
        return null; // Não exibe nada se não houver dados de rota
    }

    // ✅ CORREÇÃO: Vamos procurar fractionalRoutes em diferentes locais
    let fractionalRoutes = null;
    
    // Primeiro, tenta acessar diretamente
    if (parsedRouteData.fractionalRoutes && Array.isArray(parsedRouteData.fractionalRoutes)) {
        fractionalRoutes = parsedRouteData.fractionalRoutes;
        console.log('🔍 Encontrou fractionalRoutes diretamente:', fractionalRoutes);
    }
    // Se não encontrou, pode estar em outro lugar da estrutura
    else if (parsedRouteData.routes && parsedRouteData.routes.fractionalRoutes) {
        fractionalRoutes = parsedRouteData.routes.fractionalRoutes;
        console.log('🔍 Encontrou fractionalRoutes em routes:', fractionalRoutes);
    }
    // ✅ NOVO: Tentar extrair das rotas econômicas/waypoints
    else if (parsedRouteData.waypoints && Array.isArray(parsedRouteData.waypoints)) {
        // Se temos waypoints, vamos criar fractionalRoutes a partir deles
        fractionalRoutes = parsedRouteData.waypoints.map((waypoint, index) => ({
            destination: {
                city: waypoint.name ? waypoint.name.replace(/^(Parada \d+: |Destino: )/, '').split('/')[0] : `Parada ${index + 1}`,
                state: waypoint.name ? waypoint.name.replace(/^(Parada \d+: |Destino: )/, '').split('/')[1] : 'N/A'
            },
            data: null // Sem dados detalhados, mas mostra as paradas
        }));
        
        // Adiciona o destino final se não estiver nos waypoints
        if (parsedRouteData.destination) {
            const destName = parsedRouteData.destination.name || parsedRouteData.destination;
            if (typeof destName === 'string') {
                const [city, state] = destName.replace('Destino: ', '').split('/');
                fractionalRoutes.push({
                    destination: { city: city || 'Destino Final', state: state || 'N/A' },
                    data: null
                });
            }
        }
        
        console.log('🔍 Criou fractionalRoutes a partir de waypoints:', fractionalRoutes);
    }

    const isCarrier = currentUser?.userType === 'carrier';
    // ✅ NOVO: Detecta se é motorista
    const isDriver = currentUser?.userType === 'driver';
    const isFreightDelivered = map?.trackingStatus === 'delivered';

    // Se não houver rotas fracionadas, exibe uma mensagem informativa
    if (!fractionalRoutes || fractionalRoutes.length === 0) {
        console.log('🔍 Nenhuma rota fracionada encontrada');
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>Roteiro detalhado não disponível para este mapa.</span>
            </div>
        );
    }

    return (
        <Card className="bg-blue-50/30 border-blue-200">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-blue-800 flex items-center">
                    <Route className="w-5 h-5 mr-2" />
                    {isCarrier ? 'Locais de Parada' : isDriver ? 'Progresso de Entregas' : 'Roteiro Detalhado - Paradas'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Origem */}
                    <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg border border-green-200">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                🚀
                            </div>
                        </div>
                        <div className="flex-grow">
                            <p className="font-semibold text-green-800">Origem - Pederneiras/SP</p>
                            <p className="text-xs text-green-600">Ponto de partida</p>
                        </div>
                    </div>

                    {/* Paradas intermediárias e destino final */}
                    {fractionalRoutes.map((stop, index) => {
                        const isLastStop = index === fractionalRoutes.length - 1;
                        // ✅ CORREÇÃO: Usar a mesma lógica robusta que funciona na página MeusFretes
                        const safeDeliveredStops = Array.isArray(deliveredStops) ? deliveredStops : [];
                        
                        // ✅ ADICIONANDO LOGS DETALHADOS PARA CADA PARADA
                        console.log(`🔍 [RouteStopsDisplay] Verificando parada ${index + 1}:`, {
                            stopCity: stop.destination.city,
                            deliveredStops: safeDeliveredStops,
                            comparisons: safeDeliveredStops.map(deliveredStop => ({
                                original: deliveredStop,
                                cleaned: deliveredStop.includes(':') 
                                    ? deliveredStop.split(':')[1].split('/')[0].trim() 
                                    : deliveredStop.trim(),
                                matches: (deliveredStop.includes(':') 
                                    ? deliveredStop.split(':')[1].split('/')[0].trim() 
                                    : deliveredStop.trim()) === stop.destination.city.trim()
                            }))
                        });

                        const isDelivered = safeDeliveredStops.some(deliveredStop => {
                            // Remove formatação extra e compara apenas o nome da cidade
                            const cleanDelivered = deliveredStop.includes(':') 
                                ? deliveredStop.split(':')[1].split('/')[0].trim() 
                                : deliveredStop.trim();
                            return cleanDelivered === stop.destination.city.trim();
                        });

                        console.log(`🔍 [RouteStopsDisplay] Parada "${stop.destination.city}" é entregue?`, isDelivered);

                        // ✅ NOVO: Lógica para botões do motorista
                        const isNextStop = !isDelivered && safeDeliveredStops.length === index;
                        const isLoadingThis = loadingMapId === map?.id;
                        
                        return (
                            <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                                <div className="flex-shrink-0">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        isDelivered 
                                            ? 'bg-green-600 text-white'
                                            : isLastStop 
                                                ? 'bg-red-500 text-white' 
                                                : 'bg-orange-500 text-white'
                                    }`}>
                                        {isDelivered ? '✓' : index + 1}
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-gray-800">
                                            {stop.destination.city}/{stop.destination.state}
                                        </p>
                                        {isLastStop && (
                                            <Badge className="bg-red-100 text-red-700 text-xs">
                                                Destino Final
                                            </Badge>
                                        )}
                                        {!isLastStop && (
                                            <Badge className="bg-orange-100 text-orange-700 text-xs">
                                                Parada {index + 1}
                                            </Badge>
                                        )}
                                        {isDelivered && (
                                            <Badge className="bg-green-100 text-green-700 text-xs">
                                                Entregue
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    {/* Informações detalhadas - apenas para admin e user */}
                                    {!isCarrier && !isDriver && stop.data && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
                                            <span className="flex items-center">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                Distância: <strong className="ml-1">{stop.data.distance?.toFixed(1) || '0.0'} km</strong>
                                            </span>
                                            <span className="flex items-center">
                                                <span className="w-3 h-3 mr-1">💰</span>
                                                Pedágios: <strong className="ml-1">R$ {(stop.data.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </span>
                                            {stop.data.fuel && stop.data.fuel.cost > 0 && (
                                                <span className="flex items-center">
                                                    <span className="w-3 h-3 mr-1">⛽</span>
                                                    Combustível: <strong className="ml-1">R$ {stop.data.fuel.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Apenas localização para transportadoras */}
                                    {isCarrier && (
                                        <p className="text-xs text-gray-600">
                                            <MapPin className="w-3 h-3 inline mr-1" />
                                            {isLastStop ? 'Entrega final' : `Parada intermediária ${index + 1}`}
                                        </p>
                                    )}

                                    {/* ✅ NOVO: Para motoristas, mostra status da entrega */}
                                    {isDriver && (
                                        <p className="text-xs text-gray-600">
                                            {isDelivered ? '✅ Entrega concluída' : (isNextStop ? '🎯 Próximo destino' : '⏳ Pendente')}
                                        </p>
                                    )}
                                </div>

                                {/* ✅ NOVO: Botões de ação para motoristas */}
                                {isDriver && !isDelivered && !isFreightDelivered && (
                                    <div className="flex-shrink-0">
                                        <Button
                                            size="sm"
                                            onClick={() => onUpdateStatus && onUpdateStatus(map, stop.destination)}
                                            disabled={isLoadingThis || !isNextStop}
                                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
                                        >
                                            {isLoadingThis && isNextStop ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4 mr-1" />
                                            )}
                                            {isLastStop ? 'Finalizar Frete' : 'Marcar Entrega'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Resumo para admin/user */}
                {!isCarrier && !isDriver && fractionalRoutes.some(stop => stop.data) && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-2">📊 Resumo do Roteiro:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Total de Paradas:</span>
                                <strong className="ml-2 text-blue-600">{fractionalRoutes.length}</strong>
                            </div>
                            <div>
                                <span className="text-gray-600">Distância Total:</span>
                                <strong className="ml-2 text-blue-600">
                                    {parsedRouteData.routes?.economic?.distance?.toFixed(1) || 'N/A'} km
                                </strong>
                            </div>
                            <div>
                                <span className="text-gray-600">Pedágios Total:</span>
                                <strong className="ml-2 text-blue-600">
                                    R$ {(parsedRouteData.routes?.economic?.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </strong>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
