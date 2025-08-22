import React, { useEffect, useState } from 'react';
import { User } from '@/components/ApiDatabase';
import { createPageUrl } from '@/utils';

export default function RouteGuard({ children, currentPageName }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkUserAndAuthorization = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        if (user) {
          const authorized = checkPageAuthorization(user.userType, currentPageName);
          setIsAuthorized(authorized);
          
          // Se não autorizado, redireciona para página apropriada
          if (!authorized) {
            const redirectPage = getDefaultPageForUserType(user.userType);
            window.location.href = createPageUrl(redirectPage);
            return;
          }
        } else {
          // Usuário não logado - permitir acesso apenas a páginas públicas
          const publicPages = ['Quote'];
          if (!publicPages.includes(currentPageName)) {
            window.location.href = createPageUrl('Quote');
            return;
          }
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Erro ao verificar autorização:', error);
        // Em caso de erro, assumir usuário não logado
        const publicPages = ['Quote'];
        if (publicPages.includes(currentPageName)) {
          setIsAuthorized(true);
        } else {
          window.location.href = createPageUrl('Quote');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAndAuthorization();
  }, [currentPageName]);

  // Define quais páginas cada tipo de usuário pode acessar
  const checkPageAuthorization = (userType, pageName) => {
    const pagePermissions = {
      admin: [
        'Quote', 'Negotiation', 'Contracted', 'Reports', 'ChartsPage', 
        'Users', 'TruckTypes', 'Carriers'
      ],
      user: [
        'Quote', 'Negotiation', 'Contracted', 'Reports', 'ChartsPage'
      ],
      carrier: [
        'Negotiation', 'Contracted'
      ],
      driver: [
        'MeusFretes'
      ]
    };

    const allowedPages = pagePermissions[userType] || [];
    return allowedPages.includes(pageName);
  };

  // Define a página padrão para cada tipo de usuário
  const getDefaultPageForUserType = (userType) => {
    const defaultPages = {
      admin: 'Quote',
      user: 'Quote', 
      carrier: 'Negotiation',
      driver: 'MeusFretes'
    };
    
    return defaultPages[userType] || 'Quote';
  };

  // Mostra loading enquanto verifica autorização
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Mostra página não autorizada se necessário (não deveria chegar aqui devido ao redirect)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">
            Você não tem permissão para acessar esta página.
          </p>
          <button 
            onClick={() => window.location.href = createPageUrl(getDefaultPageForUserType(currentUser?.userType))}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            Ir para Página Inicial
          </button>
        </div>
      </div>
    );
  }

  // Se autorizado, renderiza o conteúdo da página
  return children;
}