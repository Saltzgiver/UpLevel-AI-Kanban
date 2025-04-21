/**
 * Zapier MCP Client
 * 
 * This module provides a wrapper around the Zapier MCP API client for integration with our application.
 * It includes functionality for making MCP API calls, logging requests/responses, and handling errors.
 */

import * as crypto from 'crypto';
import { storage } from './storage';
import { mcpLogs } from '../shared/schema';
import { log } from './vite';
import { db } from './db';

export interface McpActionParams {
  [key: string]: string | number | boolean | object;
}

export interface McpResponse {
  success: boolean;
  external_id?: string | number;
  external_url?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Implementation of the Zapier MCP client
 * Using native fetch API instead of a dedicated package
 */
export class McpClient {
  private endpoint: string;
  private apiKey: string;

  constructor(config: { endpoint: string; apiKey: string }) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
  }

  /**
   * Invoke an MCP action
   */
  async invoke(params: { action: string; action_params: McpActionParams }): Promise<McpResponse> {
    try {
      if (!this.endpoint) {
        throw new Error('MCP configuration missing: endpoint not set');
      }

      // For Zapier webhook integrations, the action is part of the query parameters
      // Build URL with query parameters for GET request
      let url = this.endpoint;
      
      // Add action and parameters as query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('action', params.action);
      
      // Add all action parameters as query parameters
      for (const [key, value] of Object.entries(params.action_params)) {
        queryParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
      }
      
      // Append query string to URL
      url = `${url}?${queryParams.toString()}`;
      
      // Headers setup
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Only add auth headers if API key is provided and not the placeholder
      if (this.apiKey && this.apiKey !== 'no-key-required') {
        const signature = this.createSignature(url);
        headers['X-MCP-Key'] = this.apiKey;
        headers['X-MCP-Signature'] = signature;
      }
      
      // Make the request using GET method
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      log(`MCP client error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create HMAC signature for request authentication
   */
  private createSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.apiKey);
    hmac.update(payload);
    return hmac.digest('hex');
  }
}

/**
 * Get the configured MCP client singleton
 */
export function getMcpClient(): McpClient {
  const endpoint = process.env.ZAPIER_MCP_ENDPOINT || '';
  const apiKey = process.env.ZAPIER_MCP_KEY || 'no-key-required';
  
  return new McpClient({ endpoint, apiKey });
}

/**
 * Run an MCP action with the configured client
 */
export async function runMcpAction(
  actionName: string, 
  params: McpActionParams, 
  cardId?: number, 
  columnId?: number
): Promise<McpResponse> {
  const startTime = Date.now();
  
  try {
    // Get the MCP client
    const client = getMcpClient();
    
    // Log the request
    log(`Invoking MCP action: ${actionName}`);
    
    // Invoke the action
    const result = await client.invoke({
      action: actionName,
      action_params: params
    });
    
    // Log the successful request
    const duration = Date.now() - startTime;
    await logMcpRequest(
      'outbound',
      `/actions/${actionName}`,
      null,
      JSON.stringify(params),
      JSON.stringify(result),
      200,
      duration,
      null,
      cardId,
      columnId
    );
    
    return result;
  } catch (error: any) {
    // Log the failed request
    const duration = Date.now() - startTime;
    await logMcpRequest(
      'outbound',
      `/actions/${actionName}`,
      null,
      JSON.stringify(params),
      JSON.stringify({ error: error.message }),
      500,
      duration,
      error.message,
      cardId,
      columnId
    );
    
    throw error;
  }
}

/**
 * Validate an HMAC signature for inbound webhooks
 */
export function validateMcpSignature(signature: string, payload: string, key: string): boolean {
  try {
    if (!signature || !key) return false;
    
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'), 
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    log(`Error validating MCP signature: ${error}`);
    return false;
  }
}

/**
 * Log an MCP request or response
 */
export async function logMcpRequest(
  direction: 'inbound' | 'outbound',
  endpoint: string,
  requestId: string | null,
  requestBody: string,
  responseBody: string,
  statusCode: number,
  duration: number,
  error: string | null,
  cardId?: number | null,
  columnId?: number | null
): Promise<void> {
  try {
    const truncatedRequest = requestBody.length > 4000 
      ? requestBody.substring(0, 4000) + '...(truncated)'
      : requestBody;
      
    const truncatedResponse = responseBody.length > 4000
      ? responseBody.substring(0, 4000) + '...(truncated)'
      : responseBody;
    
    await db.insert(mcpLogs).values({
      direction,
      endpoint,
      requestId,
      requestBody: truncatedRequest,
      responseBody: truncatedResponse,
      statusCode,
      duration,
      error,
      cardId: cardId || null,
      columnId: columnId || null
    });
  } catch (logError) {
    // Don't let logging errors propagate
    log(`Error logging MCP request: ${logError}`);
  }
}