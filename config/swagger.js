/**
 * Swagger/OpenAPI Configuration
 * API Documentation setup
 */

let swaggerJsdoc = null;
let swaggerUi = null;

// Initialize swagger packages (will be called from app.js)
async function initializeSwagger() {
    if (swaggerJsdoc && swaggerUi) {
        return { swaggerJsdoc, swaggerUi };
    }
    
    try {
        const swaggerJsdocModule = await import('swagger-jsdoc');
        const swaggerUiModule = await import('swagger-ui-express');
        swaggerJsdoc = swaggerJsdocModule.default;
        swaggerUi = swaggerUiModule.default;
        return { swaggerJsdoc, swaggerUi };
    } catch (error) {
        // Swagger packages not installed - will be handled gracefully in app.js
        return { swaggerJsdoc: null, swaggerUi: null };
    }
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sello API',
      version: '1.0.0',
      description: 'API documentation for Sello - Car Marketplace Platform',
      contact: {
        name: process.env.SITE_NAME || 'Sello Support',
        email: process.env.SUPPORT_EMAIL || 'support@example.com'
      },
      license: {
        name: 'ISC',
        url: process.env.PRODUCTION_URL || process.env.FRONTEND_URL || 'https://example.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || (process.env.PRODUCTION_URL ? `${process.env.PRODUCTION_URL}/api` : 'http://localhost:4000/api'),
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ].filter(server => server.url && server.url !== 'undefined/api'), // Remove invalid servers
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in cookie'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Success message'
            }
          }
        },
        Car: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            make: {
              type: 'string',
              example: 'Toyota'
            },
            model: {
              type: 'string',
              example: 'Corolla'
            },
            year: {
              type: 'number',
              example: 2020
            },
            price: {
              type: 'number',
              example: 2500000
            },
            images: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string'
            },
            name: {
              type: 'string',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              example: 'john@example.com'
            },
            role: {
              type: 'string',
              enum: ['user', 'dealer', 'admin'],
              example: 'user'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Cars',
        description: 'Car listing endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Admin',
        description: 'Admin panel endpoints'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js'
  ]
};

function getSwaggerSpec() {
    if (!swaggerJsdoc) {
        return null;
    }
    
    try {
        return swaggerJsdoc(options);
    } catch (error) {
        // Swagger spec generation failed
        return null;
    }
}

export { initializeSwagger, getSwaggerSpec, swaggerUi };

