import { Controller, Get, Query } from '@nestjs/common';
import { JupyterService } from './jupyter.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Jupyter')
@Controller('api/v1/jupyter')
export class JupyterController {
  constructor(private readonly jupyterService: JupyterService) {}

  @Get('visualization-url')
  @ApiOperation({ summary: 'Get a Voila URL for an embedded visualization' })
  @ApiQuery({ name: 'notebook', required: true, description: 'Name of the notebook configuration (e.g. transaction-history)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Entity ID parameter to pass to the notebook' })
  @ApiResponse({ status: 200, description: 'Returns the iframe-ready URL' })
  getVisualizationUrl(@Query('notebook') notebook: string, @Query() queryParams: Record<string, string>): { url: string } {
    // Extract unknown params to pass forward
    const { notebook: _n, ...params } = queryParams;

    return {
      url: this.jupyterService.getVisualizationUrl(notebook, params),
    };
  }
}
