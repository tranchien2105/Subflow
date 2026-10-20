
import { IsUrl } from 'class-validator';

export class ImportVideoDto {
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    {
      message: 'sourceUrl phải là URL HTTP hoặc HTTPS hợp lệ',
    },
  )
  sourceUrl: string;
}
