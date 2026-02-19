import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JupyterService {
  private voilaUrl: string;

  constructor(private configService: ConfigService) {
    // Require VOILA_URL to be provided via environment / config
    this.voilaUrl = this.configService.getOrThrow<string>('VOILA_URL') || 'http://10.10.80.19:8866';
  }

  getVisualizationUrl(notebookName: string, params: Record<string, string>): string {
    // Basic validation of notebook name to prevent directory traversal
    if (!notebookName || notebookName.includes('..') || notebookName.includes('/')) {
      throw new NotFoundException('Invalid notebook name');
    }

    const notebookMapping: Record<string, string> = {
      'transaction-history': 'transaction-viz.ipynb',
      'alert-history': 'alert-history.ipynb',
      'transaction-network': 'transaction-network.ipynb',
    };

    const filename = notebookMapping[notebookName];
    if (!filename) {
      throw new NotFoundException(`Notebook '${notebookName}' not configured`);
    }

    // Construct Query String
    const queryParams = new URLSearchParams(params).toString();

    // Voila URL format: /voila/render/path/to/notebook.ipynb?param=value
    return `${this.voilaUrl}/voila/render/${filename}?${queryParams}`;
  }
}
