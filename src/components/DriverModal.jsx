import React, { useState, useEffect } from 'react';
import { User as UserIcon, Phone, CreditCard, Plus, Check } from 'lucide-react';
import { User } from '@/components/ApiDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DriverModal({ isOpen, onClose, mapNumber, carrierName, onDriverAssigned }) {
  const [existingDrivers, setExistingDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    phone: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadExistingDrivers();
    }
  }, [isOpen, carrierName]);

  const loadExistingDrivers = async () => {
    try {
      const users = await User.list();
      const drivers = users.filter(user => 
        user.userType === 'driver' && 
        user.carrierName === carrierName && 
        user.active
      );
      setExistingDrivers(drivers);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'cpf') {
      // Remove tudo que não é número
      const numbers = value.replace(/\D/g, '');
      // Limita a 11 dígitos
      const truncated = numbers.slice(0, 11);
      // Aplica máscara XXX.XXX.XXX-XX
      let masked = truncated;
      if (truncated.length > 3) {
        masked = `${truncated.slice(0, 3)}.${truncated.slice(3)}`;
      }
      if (truncated.length > 6) {
        masked = `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6)}`;
      }
      if (truncated.length > 9) {
        masked = `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6, 9)}-${truncated.slice(9)}`;
      }
      setFormData(prev => ({ ...prev, [field]: masked }));
    } else if (field === 'phone') {
      // Remove tudo que não é número
      const numbers = value.replace(/\D/g, '');
      // Limita a 11 dígitos
      const truncated = numbers.slice(0, 11);
      // Aplica máscara (XX) XXXXX-XXXX
      let masked = truncated;
      if (truncated.length > 0) {
        masked = `(${truncated}`;
      }
      if (truncated.length > 2) {
        masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
      }
      if (truncated.length > 7) {
        masked = `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
      }
      setFormData(prev => ({ ...prev, [field]: masked }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAssignExistingDriver = async () => {
    if (!selectedDriverId) return;

    setLoading(true);
    try {
      // Atualiza o motorista com o novo mapa
      await User.update(selectedDriverId, {
        assignedMapNumber: mapNumber
      });
      
      onDriverAssigned(selectedDriverId);
      onClose();
    } catch (error) {
      console.error('Erro ao vincular motorista:', error);
      alert('Erro ao vincular motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewDriver = async () => {
    if (!formData.fullName || !formData.cpf || !formData.phone) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      // Remove máscara do CPF para validação
      const cpfNumbers = formData.cpf.replace(/\D/g, '');
      if (cpfNumbers.length !== 11) {
        alert('CPF deve ter 11 dígitos');
        return;
      }

      // Remove máscara do telefone
      const phoneNumbers = formData.phone.replace(/\D/g, '');
      if (phoneNumbers.length < 10) {
        alert('Telefone deve ter pelo menos 10 dígitos');
        return;
      }

      const newDriver = {
        fullName: formData.fullName,
        username: cpfNumbers, // Usa CPF como username
        email: `${cpfNumbers}@driver.unionagro.com`, // Email automático
        password: '123456', // Senha padrão
        userType: 'driver',
        carrierName: carrierName,
        cpf: formData.cpf,
        phone: formData.phone,
        assignedMapNumber: mapNumber,
        active: true
      };

      const createdDriver = await User.create(newDriver);
      onDriverAssigned(createdDriver.id);
      onClose();
    } catch (error) {
      console.error('Erro ao criar motorista:', error);
      if (error.message.includes('já está em uso')) {
        alert('Este CPF já está cadastrado no sistema');
      } else {
        alert('Erro ao criar motorista');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ fullName: '', cpf: '', phone: '' });
    setSelectedDriverId('');
    setIsCreatingNew(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserIcon className="w-5 h-5 mr-2" />
            Cadastrar Motorista
          </DialogTitle>
          <DialogDescription>
            Mapa: {mapNumber} | Transportadora: {carrierName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isCreatingNew && existingDrivers.length > 0 && (
            <>
              <div>
                <Label>Selecionar Motorista Existente</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um motorista cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingDrivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.fullName} - {driver.cpf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleAssignExistingDriver}
                  disabled={!selectedDriverId || loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {loading ? 'Vinculando...' : 'Vincular Motorista'}
                </Button>
              </div>

              <div className="text-center">
                <Button 
                  variant="outline"
                  onClick={() => setIsCreatingNew(true)}
                  className="border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Novo Motorista
                </Button>
              </div>
            </>
          )}

          {(isCreatingNew || existingDrivers.length === 0) && (
            <>
              {existingDrivers.length > 0 && (
                <div className="text-center">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingNew(false)}
                  >
                    ← Voltar para motoristas existentes
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="Digite o nome do motorista"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => handleInputChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCreateNewDriver}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Criando...' : 'Criar e Vincular Motorista'}
              </Button>
            </>
          )}

          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}