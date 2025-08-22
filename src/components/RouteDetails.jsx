import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Route, MapPin, Receipt, Truck, AlertTriangle } from "lucide-react";

export default function RouteDetails({ routeData }) {
    if (!routeData) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>Dados de rota detalhados não disponíveis para esta cotação.</span>
            </div>
        );
    }
    
    const { fractionalRoutes, routes } = routeData;
    const economicRouteTolls = routes?.economic?.tollData;

    return (
        <div className="space-y-4">
            {fractionalRoutes && fractionalRoutes.length > 0 && (
                <Card className="bg-gray-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-700 flex items-center">
                            <Route className="w-5 h-5 mr-2 text-blue-600" />
                            Distâncias Fracionadas (Origem até cada Ponto)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {fractionalRoutes.map((fracRoute, index) => (
                                <div key={index} className="p-2 border rounded-md bg-white text-sm">
                                    <div className="font-medium text-gray-800 flex items-center">
                                       <Badge variant="outline" className="mr-2 border-blue-400 text-blue-700">{index + 1}</Badge>
                                       {fracRoute.destination.city}/{fracRoute.destination.state}
                                    </div>
                                    {fracRoute.data ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-2 pl-8 text-xs">
                                            <span className="flex items-center" title="Distância">
                                                <MapPin className="w-3 h-3 mr-1.5 text-gray-500" />
                                                <span className="font-semibold">{fracRoute.data.distance?.toFixed(1) || '0.0'} km</span>
                                            </span>
                                            <span className="flex items-center" title="Custo Pedágio">
                                                <Receipt className="w-3 h-3 mr-1.5 text-gray-500" />
                                                <span className="font-semibold">
                                                  R$ {(fracRoute.data.tollData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </span>
                                            {fracRoute.data.fuel && fracRoute.data.fuel.cost > 0 && (
                                              <span className="flex items-center" title="Custo Combustível">
                                                  <span className="w-3 h-3 mr-1.5 text-gray-500">⛽</span>
                                                  <span className="font-semibold">
                                                    R$ {fracRoute.data.fuel.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                  </span>
                                              </span>
                                            )}
                                        </div>
                                    ) : (
                                         <p className="text-red-500 text-xs flex items-center mt-1 pl-8">
                                            <AlertTriangle className="w-3 h-3 mr-2" />
                                            Não foi possível calcular esta perna.
                                         </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {economicRouteTolls && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-base font-semibold text-gray-700 flex items-center hover:no-underline [&[data-state=open]>svg]:rotate-180">
                            <div className="flex items-center">
                                <Receipt className="w-5 h-5 mr-2 text-red-600" />
                                Detalhes dos Pedágios (Rota Completa)
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="p-4 bg-white border rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-red-600">{economicRouteTolls.tolls.length}</p>
                                        <p className="text-xs text-gray-600">Pedágios na Rota</p>
                                    </div>
                                     <div>
                                        <p className="text-2xl font-bold text-green-600">
                                            R$ {(economicRouteTolls.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-gray-600">Custo Total (Tag)</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 flex items-center justify-center">
                                            <Truck className="w-4 h-4 mr-1" />
                                            {economicRouteTolls.vehicleInfo?.type || 'Veículo Padrão'}
                                        </p>
                                        <p className="text-xs text-gray-600">Veículo Calculado</p>
                                    </div>
                                </div>
                                
                                {economicRouteTolls.tolls.length > 0 && (
                                    <div className="mt-4 max-h-48 overflow-y-auto">
                                        <h5 className="font-medium text-gray-700 mb-2 text-sm">Lista de Pedágios:</h5>
                                        <div className="space-y-1">
                                        {economicRouteTolls.tolls.map((toll, index) => (
                                            <div key={toll.id || index} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded border">
                                                <div>
                                                    <span className="font-medium">{toll.name || `Pedágio ${index + 1}`}</span>
                                                    {toll.road && <span className="text-gray-500 ml-2">({toll.road})</span>}
                                                </div>
                                                <span className="font-bold text-red-600">
                                                    R$ {(toll.cost || 0)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                )}
                             </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
}