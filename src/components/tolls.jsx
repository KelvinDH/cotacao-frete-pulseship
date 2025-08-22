
// ✅ IMPORTAR DADOS DA BASE EXPANDIDA
import { tollDatabase } from './tollsData';

// Função auxiliar: Calcular distância entre dois pontos em metros
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ✅ FUNÇÃO: Encontrar pedágio mais próximo na base de dados dentro de um raio
export function findClosestToll(point, tollDb, radiusKm = 3) {
  const [lat, lon] = point;
  let closestToll = null;
  let minDistance = Infinity;
  
  tollDb.forEach(toll => {
    const distance = calculateDistance(lat, lon, toll.lat, toll.lon);
    if (distance <= radiusKm * 1000 && distance < minDistance) {
      minDistance = distance;
      closestToll = toll;
    }
  });
  
  return closestToll;
}

// ✅ FUNÇÃO HÍBRIDA COM LÓGICA PRECISA
export function findTollsOnRoute(routeCoordinates, apiTollPoints = [], radiusKm = 0.15) { // Raio padrão de 150m
  const tollsFound = [];
  const processedTolls = new Set(); 

  // --- PASSO 1: Processar pedágios de alta confiança retornados pela API ---
  if (apiTollPoints && apiTollPoints.length > 0) {
    console.log(`PASS 1: Processando ${apiTollPoints.length} pedágio(s) da API.`);
    apiTollPoints.forEach((point) => {
      const matchingToll = findClosestToll(point, tollDatabase, 3); // Raio maior para mapear API -> DB
      if (matchingToll && !processedTolls.has(matchingToll.id)) {
        tollsFound.push({ ...matchingToll, source: 'database', apiDetected: true });
        processedTolls.add(matchingToll.id);
      }
    });
  } else {
    console.log("PASS 1: API não retornou pedágios explícitos. Usando verificação de rota.");
  }
  
  // --- PASSO 2: Verificação precisa na nossa base de dados ---
  console.log(`PASS 2: Verificando ${tollDatabase.length} pedágios da base contra a geometria da rota com um raio de ${radiusKm * 1000}m.`);
  if (routeCoordinates && routeCoordinates.length > 0) {
    tollDatabase.forEach(toll => {
      if (processedTolls.has(toll.id)) return;

      // Verifica se o pedágio está muito próximo de qualquer um dos pontos da rota.
      // Com uma rota de alta resolução, isso é preciso o suficiente.
      for (const routePoint of routeCoordinates) {
        const distance = calculateDistance(toll.lat, toll.lon, routePoint[0], routePoint[1]);
        
        // Se a distância for menor que o raio (ex: 150 metros), consideramos que está na rota.
        if (distance <= radiusKm * 1000) {
          tollsFound.push({ ...toll, source: 'database', apiDetected: false });
          processedTolls.add(toll.id);
          break; // Sai do loop interno uma vez que o pedágio é encontrado
        }
      }
    });
  }
  
  // --- PASSO 3: Ordenar os pedágios encontrados pela ordem na rota ---
  if (routeCoordinates && routeCoordinates.length > 0 && tollsFound.length > 0) {
    const originLat = routeCoordinates[0][0];
    const originLon = routeCoordinates[0][1];
    
    tollsFound.sort((a, b) => {
      const distA = calculateDistance(originLat, originLon, a.lat, a.lon);
      const distB = calculateDistance(originLat, originLon, b.lat, b.lon);
      return distA - distB;
    });
  }
  
  console.log(`Busca finalizada. Total de pedágios encontrados na rota: ${tollsFound.length}`);
  return tollsFound;
}

// ✅ FUNÇÃO: Calcular custo total dos pedágios
export function calculateTotalTollCost(tollsArray, vehicleType = 'truck') {
  if (!Array.isArray(tollsArray) || tollsArray.length === 0) {
    return 0;
  }
  
  return tollsArray
    .filter(toll => toll.source === 'database')
    .reduce((total, toll) => {
      const cost = vehicleType === 'truck' ? toll.truck : toll.car;
      return total + (cost || 0);
    }, 0);
}

// ✅ EXPORTAR DADOS E FUNÇÕES PARA USO EXTERNO
export { tollDatabase };
