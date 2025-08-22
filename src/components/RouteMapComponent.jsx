import React, { useEffect, useRef } from 'react';

export default function RouteMapComponent({
  origin, // [lat, lon]
  destination, // [lat, lon]
  route, // para single route
  waypoints, // para múltiplas paradas
  economicRoute, // para comparação
  shortestRoute, // para comparação
  height = '400px'
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  console.log('🗺️ RouteMapComponent - Dados recebidos:', {
    origin,
    destination,
    route: route,
    hasTollData: !!route?.tollData,
    tollsCount: route?.tollData?.tolls?.length || 0,
    totalCost: route?.tollData?.totalCost || 0,
    geometry: route?.geometry,
    waypoints,
    economicRoute: economicRoute ? {
      distance: economicRoute.distance,
      tollData: economicRoute.tollData,
      geometry: economicRoute.geometry?.length || 0
    } : null,
    shortestRoute: shortestRoute ? {
      distance: shortestRoute.distance,
      tollData: shortestRoute.tollData,
      geometry: shortestRoute.geometry?.length || 0
    } : null
  });

  // ✅ ATUALIZADO: Condição de renderização para suportar ambos os modos
  if (!origin || !destination || !Array.isArray(origin) || !Array.isArray(destination) || origin.length < 2 || destination.length < 2) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300" style={{ height }}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="font-medium">Mapa da Rota</p>
          <p className="text-sm">
            {waypoints ? 'Selecione destinos para comparar rotas' : 'Selecione origem e destino para visualizar'}
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const loadLeaflet = async () => {
      if (!window.L) {
        return new Promise((resolve) => {
          if (document.querySelector('link[href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"]')) {
             // Se já existe, não adiciona de novo
          } else {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(cssLink);
          }

          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => {
            delete window.L.Icon.Default.prototype._getIconUrl;
            window.L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
              iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
            resolve();
          };
          document.head.appendChild(script);
        });
      }
    };

    const initMap = async () => {
      await loadLeaflet();
      if (!isMounted || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const L = window.L;
      const map = L.map(mapRef.current);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const routeLayers = L.featureGroup().addTo(map);

      // ÍCONES PERSONALIZADOS
      const originSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#22c55e" stroke="#ffffff" stroke-width="1"/><circle cx="12" cy="9" r="3" fill="#ffffff"/><path d="M10 9l2 2 4-4" stroke="#22c55e" stroke-width="2" fill="none"/></svg>`;
      const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="#ffffff" stroke-width="1"/><circle cx="12" cy="9" r="4" fill="#ffffff"/><circle cx="12" cy="9" r="3" fill="#ef4444"/><circle cx="12" cy="9" r="2" fill="#ffffff"/><circle cx="12" cy="9" r="1" fill="#ef4444"/></svg>`;
      const tollSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10" fill="#f97316" stroke="#ffffff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">$</text></svg>`;

      const originIcon = L.icon({ iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(originSvg)}`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
      const destinationIcon = L.icon({ iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(destinationSvg)}`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
      const tollIcon = L.icon({ iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(tollSvg)}`, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });

      // Adicionar marcadores de origem e destino
      routeLayers.addLayer(L.marker(origin, { icon: originIcon }).bindPopup('<b>🚀 Origem: Pederneiras/SP</b>'));
      routeLayers.addLayer(L.marker(destination, { icon: destinationIcon }).bindPopup('<b>🎯 Destino</b>'));

      // ✅ NOVO: Adicionar waypoints se existirem
      if (waypoints && Array.isArray(waypoints)) {
        waypoints.forEach((waypoint, index) => {
          const waypointSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10" fill="#2d16f9ff" stroke="#ffffff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${index + 1}</text></svg>`;
          const waypointIcon = L.icon({ 
            iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(waypointSvg)}`, 
            iconSize: [28, 28], 
            iconAnchor: [14, 28], 
            popupAnchor: [0, -28] 
          });
          routeLayers.addLayer(
            L.marker(waypoint.coordinates, { icon: waypointIcon })
              .bindPopup(`<b>📍 ${waypoint.name}</b>`)
          );
        });
      }

      // ✅ CORRIGIDO: Desenhar rotas (modo simples ou comparação)
      if (economicRoute && shortestRoute) {
        // Modo comparação - duas rotas
        if (economicRoute.geometry && Array.isArray(economicRoute.geometry) && economicRoute.geometry.length > 2) {
          routeLayers.addLayer(L.polyline(economicRoute.geometry, { 
            color: '#16a34a', weight: 5, opacity: 0.8, dashArray: '10, 5' 
          }));
        }
        if (shortestRoute.geometry && Array.isArray(shortestRoute.geometry) && shortestRoute.geometry.length > 2) {
          routeLayers.addLayer(L.polyline(shortestRoute.geometry, { 
            color: '#2563eb', weight: 5, opacity: 0.8 
          }));
        }

        // ✅ CORRIGIDO: Adicionar pedágios de ambas as rotas
        if (economicRoute.tollData && economicRoute.tollData.tolls && Array.isArray(economicRoute.tollData.tolls)) {
          economicRoute.tollData.tolls.forEach((toll, index) => {
            if (toll.lat && toll.lng) {
              const tollMarker = L.marker([toll.lat, toll.lng], { icon: tollIcon })
                .bindPopup(`
                  <div class="text-center">
                    <h4 class="font-bold text-green-600">Rota Mais Curta</h4>
                    <p class="font-bold">${toll.name || `Pedágio ${index + 1}`}</p>
                    <p class="text-sm">R$ ${(toll.cost || 0).toFixed(2)}</p>
                  </div>
                `);
              routeLayers.addLayer(tollMarker);
            }
          });
        }

        if (shortestRoute.tollData && shortestRoute.tollData.tolls && Array.isArray(shortestRoute.tollData.tolls)) {
          shortestRoute.tollData.tolls.forEach((toll, index) => {
            if (toll.lat && toll.lng) {
              const tollMarker = L.marker([toll.lat, toll.lng], { icon: tollIcon })
                .bindPopup(`
                  <div class="text-center">
                    <h4 class="font-bold text-blue-600">Rota Econômica</h4>
                    <p class="font-bold">${toll.name || `Pedágio ${index + 1}`}</p>
                    <p class="text-sm">R$ ${(toll.cost || 0).toFixed(2)}</p>
                  </div>
                `);
              routeLayers.addLayer(tollMarker);
            }
          });
        }

        // Adicionar legenda
        const legend = L.control({position: 'bottomleft'});
        legend.onAdd = function () {
          const div = L.DomUtil.create('div', 'legend');
          div.innerHTML = `
            <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
              <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 20px; height: 3px; background-color: #16a34a; border-bottom: 2px dashed #16a34a; margin-right: 5px; vertical-align: middle;"></span> Rota Mais Curta</div>
              <div><span style="display: inline-block; width: 20px; height: 3px; background-color: #2563eb; margin-right: 5px; vertical-align: middle;"></span> Rota Econômica</div>
            </div>
          `;
          return div;
        };
        legend.addTo(map);

      } else if (route) {
        // Modo simples - uma rota
        if (route.geometry && Array.isArray(route.geometry) && route.geometry.length > 2) {
            routeLayers.addLayer(L.polyline(route.geometry, { color: '#3b82f6', weight: 5, opacity: 0.7 }));
        } else {
            routeLayers.addLayer(L.polyline([origin, destination], { color: '#94a3b8', weight: 3, opacity: 0.5, dashArray: '10, 10' }));
        }

        // ✅ CORRIGIDO: Adicionar marcadores de pedágio
        if (route && route.tollData && route.tollData.tolls && Array.isArray(route.tollData.tolls)) {
          route.tollData.tolls.forEach((toll, index) => {
            if (toll.lat && toll.lng) {
              const tollMarker = L.marker([toll.lat, toll.lng], { icon: tollIcon })
                .bindPopup(`
                  <div class="text-center">
                    <h4 class="font-bold text-orange-600">${toll.name || `Pedágio ${index + 1}`}</h4>
                    <p class="text-sm text-gray-600">${toll.road || ''}</p>
                    <div class="mt-2">
                      <p class="text-sm font-bold text-orange-600">
                        R$ ${(toll.cost || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                `);
              routeLayers.addLayer(tollMarker);
            }
          });
        }
      }
      
      // Ajustar zoom do mapa
      setTimeout(() => {
        if (mapInstanceRef.current && routeLayers.getBounds().isValid()) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.fitBounds(routeLayers.getBounds().pad(0.1));
        } else if (mapInstanceRef.current) {
            // Fallback for cases where routeLayers might be empty or invalid (e.g., only origin/destination markers)
            mapInstanceRef.current.invalidateSize();
            mapInstanceRef.current.fitBounds(L.latLngBounds([origin, destination]).pad(0.1));
        }
      }, 10);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [origin, destination, route, waypoints, economicRoute, shortestRoute]);

  return (
    <>
      <div className="relative rounded-lg overflow-hidden border border-gray-300 shadow-sm">
        <div ref={mapRef} style={{ width: '100%', height, minHeight: '300px' }} className="bg-gray-100" />
        
        {/* ✅ ATUALIZADO: Info box para modo simples */}
        {route && !economicRoute && !shortestRoute && (
          <div className="absolute top-2 right-2 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg border z-[1000]">
            <div className="text-sm font-medium text-gray-800 space-y-2">
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📏</span>
                <span>Distância: {route.distance?.toFixed(1) || 'N/A'} km</span>
              </div>
              <div className="flex items-center">
                <span className="text-green-600 mr-2">⏱️</span>
                <span>Duração: {route.duration ? `${Math.floor(route.duration)}h ${Math.round((route.duration % 1) * 60)}m` : 'N/A'}</span>
              </div>
              {route.fuel && route.fuel.amount && (
                <div className="flex items-center">
                  <span className="text-orange-600 mr-2">⛽</span>
                  <span>Combustível: {route.fuel.amount.toFixed(1)} L</span>
                </div>
              )}
              {route.tollData && route.tollData.tolls && route.tollData.tolls.length > 0 && (
                <div className="flex items-center pt-2 border-t mt-2">
                  <span className="text-orange-500 mr-2">💰</span>
                  <div>
                    <div>{route.tollData.tolls.length} pedágio{route.tollData.tolls.length > 1 ? 's' : ''}</div>
                    <div className="text-xs font-bold text-orange-600">
                      Total: R$ {(route.tollData.totalCost || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
              {(!route.geometry || route.geometry.length <= 2) && (
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                  ℹ️ Rota estimada (linha direta)
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ ATUALIZADO: Info box para modo comparação */}
        {(economicRoute || shortestRoute) && (
          <div className="absolute top-2 right-2 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg border z-[1000]">
            <div className="text-sm font-medium text-gray-800 space-y-2">
              <div className="text-center font-bold text-gray-700 border-b pb-1">
                📊 Comparação de Rotas
              </div>
              {economicRoute && (
                <div className="text-green-700">
                  Mais Curta: {economicRoute.distance?.toFixed(1) || '0.0'} km | R$ {(economicRoute.tollData?.totalCost || 0).toFixed(2)}
                  {economicRoute.fuel?.amount && <span> | {economicRoute.fuel.amount.toFixed(1)}L</span>}
                </div>
              )}
              {shortestRoute && (
                <div className="text-blue-700">
                  Econômica: {shortestRoute.distance?.toFixed(1) || '0.0'} km | R$ {(shortestRoute.tollData?.totalCost || 0).toFixed(2)}
                  {shortestRoute.fuel?.amount && <span> | {shortestRoute.fuel.amount.toFixed(1)}L</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}