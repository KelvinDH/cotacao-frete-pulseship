import React from 'react';
import { Package, Truck, CheckCircle, Clock, MapPin } from 'lucide-react';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const getStatusInfo = (status, message = '') => {
    // ✅ CORREÇÃO: Lógica robusta para lidar com dados novos e antigos
    const combinedInfo = message || status; // Usa a mensagem se existir, senão o status

    if (combinedInfo.includes('concluída') || combinedInfo.includes('realizada em')) {
        return { label: 'Entrega Concluída', Icon: CheckCircle, color: 'text-green-600' };
    }
    if (combinedInfo.includes('Todos os destinos')) {
        return { label: 'Frete Finalizado', Icon: CheckCircle, color: 'text-green-700' };
    }
    if (combinedInfo.includes('Em trânsito para')) {
        return { label: 'Em Trânsito', Icon: Truck, color: 'text-orange-500' };
    }

    switch (status) {
        case 'waiting':
            return { label: 'Aguardando', Icon: Clock, color: 'text-gray-500' };
        case 'loading':
            return { label: 'Carregando', Icon: Package, color: 'text-blue-500' };
        case 'in_transit':
            return { label: 'Em Trânsito', Icon: Truck, color: 'text-orange-500' };
        case 'delivered':
            return { label: 'Entregue', Icon: CheckCircle, color: 'text-green-500' };
        default:
            return { label: 'Status Desconhecido', Icon: Clock, color: 'text-gray-400' };
    }
};

export default function TrackingTimeline({ history }) {
    if (!history || history.length === 0) {
        return (
            <div className="text-center py-4 text-sm text-gray-500">
                Nenhum histórico de rastreamento disponível.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {history.slice().reverse().map((entry, index) => {
                const { Icon, color, label: defaultLabel } = getStatusInfo(entry.status, entry.message);
                
                // ✅ CORREÇÃO: Define o texto a ser exibido, dando prioridade à mensagem
                const displayText = entry.message || (entry.status.length > 15 ? entry.status : defaultLabel);

                return (
                    <div key={index} className="flex items-start gap-3 relative">
                        {index < history.length - 1 && (
                            <div className="absolute left-4 top-8 w-px h-full bg-gray-200"></div>
                        )}
                        <div className={`flex-shrink-0 z-10 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center ${color.replace('text-', 'border-')}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="flex-grow pt-1">
                            <p className="font-semibold text-gray-800 text-sm">
                                {displayText}
                            </p>
                            <p className="text-xs text-gray-500">
                                {format(new Date(entry.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}