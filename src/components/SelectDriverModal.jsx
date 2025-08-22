import React, { useState } from 'react';
import { User, UserCheck, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';

export default function SelectDriverModal({ isOpen, onClose, drivers, onSelectDriver }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDrivers = drivers.filter(driver =>
    (driver.fullName && driver.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (driver.cpf && driver.cpf.includes(searchTerm))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Motorista Existente</DialogTitle>
        </DialogHeader>
        <div className="p-4 border-y">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-4">
          {filteredDrivers.length > 0 ? (
            <div className="space-y-3">
              {filteredDrivers.map(driver => (
                <div key={driver.id} className="border rounded-lg p-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900">{driver.fullName}</p>
                    <p className="text-sm text-gray-600">CPF: {driver.cpf}</p>
                    <p className="text-sm text-gray-600">Telefone: {driver.phone}</p>
                  </div>
                  <Button onClick={() => onSelectDriver(driver)}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Vincular
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="font-medium">Nenhum motorista encontrado</p>
              {drivers.length > 0 ? (
                 <p className="text-sm mt-1">Tente um termo de busca diferente.</p>
              ) : (
                <p className="text-sm mt-1">Não há motoristas cadastrados para esta transportadora.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={onClose}>
                Fechar
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}