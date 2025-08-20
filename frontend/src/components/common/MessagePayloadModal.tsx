import React from 'react';
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import type { TransactionMessage } from '../../types/alertsdashboard.types';

interface MessagePayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: TransactionMessage | null;
}

const MessagePayloadModal: React.FC<MessagePayloadModalProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  // Mock XML payload based on message type
  const getXmlPayload = (messageType: string) => {
    switch (messageType) {
      case 'pacs.008':
        return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>MSGID-20250820-001</MsgId>
      <CreDtTm>2025-08-20T09:15:00.000Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>50000.00</CtrlSum>
      <InstgAgt>
        <FinInstnId>
          <BICFI>BANKUSAAXXXC</BICFI>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BICFI>BANKFRPPXXXC</BICFI>
        </FinInstnId>
      </InstdAgt>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>E2E-20250820-001</EndToEndId>
        <TxId>TXN-12345</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">50000.00</IntrBkSttlmAmt>
      <IntrBkSttlmDt>2025-08-20</IntrBkSttlmDt>
      <Dbtr>
        <Nm>John Smith</Nm>
        <PstlAdr>
          <Ctry>US</Ctry>
        </PstlAdr>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>ACC-78901</Id>
          </Othr>
        </Id>
      </DbtrAcct>
      <Cdtr>
        <Nm>Global Transfers Ltd</Nm>
        <PstlAdr>
          <Ctry>FR</Ctry>
        </PstlAdr>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>ACC-56789</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>Payment for services rendered</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
      case 'pacs.002':
        return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>MSGID-20250820-002</MsgId>
      <CreDtTm>2025-08-20T09:16:30.000Z</CreDtTm>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>MSGID-20250820-001</OrgnlMsgId>
      <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
      <GrpSts>ACCC</GrpSts>
    </OrgnlGrpInfAndSts>
    <TxInfAndSts>
      <OrgnlEndToEndId>E2E-20250820-001</OrgnlEndToEndId>
      <OrgnlTxId>TXN-12345</OrgnlTxId>
      <TxSts>ACCC</TxSts>
      <AccptncDtTm>2025-08-20T09:16:30.000Z</AccptncDtTm>
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>`;
      case 'camt.056':
        return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.056.001.08">
  <FIToFIPmtCxlReq>
    <GrpHdr>
      <MsgId>MSGID-20250820-003</MsgId>
      <CreDtTm>2025-08-20T09:18:15.000Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <Undrlyg>
      <OrgnlGrpInfAndCxl>
        <OrgnlMsgId>MSGID-20250820-001</OrgnlMsgId>
        <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
        <OrgnlCreDtTm>2025-08-20T09:15:00.000Z</OrgnlCreDtTm>
      </OrgnlGrpInfAndCxl>
      <TxInf>
        <CxlId>CXL-20250820-001</CxlId>
        <OrgnlEndToEndId>E2E-20250820-001</OrgnlEndToEndId>
        <OrgnlTxId>TXN-12345</OrgnlTxId>
        <CxlRsnInf>
          <Rsn>
            <Cd>DUPL</Cd>
          </Rsn>
          <AddtlInf>Duplicate transaction detected</AddtlInf>
        </CxlRsnInf>
      </TxInf>
    </Undrlyg>
  </FIToFIPmtCxlReq>
</Document>`;
      case 'pacs.004':
        return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09">
  <PmtRtr>
    <GrpHdr>
      <MsgId>MSGID-20250820-004</MsgId>
      <CreDtTm>2025-08-20T09:20:45.000Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <TxInf>
      <RtrId>RTR-20250820-001</RtrId>
      <OrgnlEndToEndId>E2E-20250820-001</OrgnlEndToEndId>
      <OrgnlTxId>TXN-12345</OrgnlTxId>
      <OrgnlIntrBkSttlmAmt Ccy="USD">50000.00</OrgnlIntrBkSttlmAmt>
      <RtrdIntrBkSttlmAmt Ccy="USD">50000.00</RtrdIntrBkSttlmAmt>
      <RtrRsnInf>
        <Rsn>
          <Cd>AC04</Cd>
        </Rsn>
        <AddtlInf>Account closed</AddtlInf>
      </RtrRsnInf>
    </TxInf>
  </PmtRtr>
</Document>`;
      default:
        return `<?xml version="1.0" encoding="UTF-8"?>
<Document>
  <!-- XML payload for ${messageType} -->
  <MessageData>
    <MessageType>${messageType}</MessageType>
    <Timestamp>${new Date().toISOString()}</Timestamp>
    <Content>Sample message content</Content>
  </MessageData>
</Document>`;
    }
  };

  const handleDownload = () => {
    if (!message) return;

    const xmlPayload = getXmlPayload(message.type);
    const blob = new Blob([xmlPayload], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${message.type}_${message.id}_payload.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen || !message) {
    return null;
  }

  const xmlPayload = getXmlPayload(message.type);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-4xl w-full max-h-[90vh]">
          <div className="bg-white px-6 pt-6 pb-6 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Message Payload: {message.type}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {message.description}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(message.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                  Download XML
                </button>
                <button
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* XML Payload */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">XML Payload</h4>
                </div>
                <div className="p-4 overflow-auto h-full bg-gray-900">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {xmlPayload}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex-shrink-0">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Message ID: <span className="font-mono">{message.id}</span>
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePayloadModal;
