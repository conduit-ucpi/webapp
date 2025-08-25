// Mock implementation of @tanstack/react-query for Jest tests

const mockQueryClient = {
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  refetchQueries: jest.fn(),
  clear: jest.fn(),
};

const mockQueryClientClass = jest.fn(() => mockQueryClient);

module.exports = {
  QueryClient: mockQueryClientClass,
  QueryClientProvider: ({ children, client }) => children,
  useQuery: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    isError: false,
    error: null,
    data: null,
  })),
  useQueryClient: jest.fn(() => mockQueryClient),
};