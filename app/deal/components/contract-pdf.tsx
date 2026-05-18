"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components_shadcn/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Interfaces
export interface CompanyInfo {
  name: string;
  legalRepName: string;
  legalRepNationality?: string;
  legalRepMaritalStatus?: string;
  legalRepPassport?: string;
  address: string;
  registryInfo?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export interface ClientInfo {
  fullName: string;
  identificationNumber: string;
  phone: string;
  address: string;
  email?: string;
  nationality?: string;
  maritalStatus?: string;
}

export interface VehicleInfo {
  name: string;
  brand: string;
  model?: string;
  year: number;
  color: string;
  placa: string;
  vin: string;
  engineNumber?: string;
  passengerCapacity?: number;
  fuelType?: string;
  transmission?: string;
}

export interface ContractData {
  contractNumber?: string;
  contractDate: string;
  contractType?: string;
  quotaAmount: number;
  initialDeposit: number;
  totalQuotas: number;
  paymentAgreement: "semanal" | "quincenal" | "mensual";
  totalPrice?: number;
}

interface ContractPDFProps {
  company: CompanyInfo;
  client: ClientInfo;
  vehicle: VehicleInfo;
  contract: ContractData;
}

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#D4AF37",
    paddingBottom: 15,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: "contain",
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    marginTop: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#D4AF37",
    textTransform: "uppercase",
  },
  paragraph: {
    marginBottom: 12,
    textAlign: "justify",
  },
  bold: {
    fontWeight: "bold",
  },
  clauseTitle: {
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    fontSize: 11,
    textDecoration: "underline",
  },
  clauseText: {
    marginBottom: 10,
    textAlign: "justify",
  },
  indent: {
    paddingLeft: 20,
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "45%",
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    marginTop: 60,
    marginBottom: 8,
  },
  signatureLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  signatureName: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 50,
    fontSize: 9,
    color: "#888888",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    fontSize: 8,
    color: "#888888",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: "35%",
    fontWeight: "bold",
  },
  infoValue: {
    width: "65%",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 15,
  },
  bullet: {
    width: 15,
  },
  listText: {
    flex: 1,
  },
});

// Función para formatear moneda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "PAB",
    minimumFractionDigits: 2,
  }).format(value);
};

// Función para formatear fecha
const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return dateString;
  }
};

// Función para obtener texto de acuerdo de pago
const getPaymentLabel = (agreement: string): string => {
  const labels: Record<string, string> = {
    semanal: "semanal",
    quincenal: "quincenal",
    mensual: "mensual",
  };
  return labels[agreement] || agreement;
};

// Componente del documento PDF
const ContractDocument = ({ company, client, vehicle, contract }: ContractPDFProps) => {
  const contractNumber = contract.contractNumber || `C4Y-${Date.now()}`;
  const paymentLabel = getPaymentLabel(contract.paymentAgreement);

  return (
    <Document>
      {/* PÁGINA 1: Encabezado y Partes */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          {company.logoUrl && <Image src={company.logoUrl} style={styles.logo} />}
          <View>
            <Text style={styles.headerTitle}>{company.name}</Text>
            <Text style={styles.headerSubtitle}>CONTRATO DE ARRENDAMIENTO DE VEHÍCULO</Text>
          </View>
        </View>

        <Text style={styles.title}>
          CONTRATO DE ARRENDAMIENTO DE VEHÍCULO{"\n"}
          PARA SERVICIO SELECTIVO DE TRANSPORTE DE PASAJEROS
        </Text>

        <View style={styles.paragraph}>
          <Text>
            En la Ciudad de Panamá, República de Panamá, a los {formatDate(contract.contractDate)}, entre los suscritos, a saber:
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text>
            Por una parte: <Text style={styles.bold}>{company.name}</Text>, sociedad debidamente inscrita{" "}
            {company.registryInfo || "en el Registro Público de Panamá"}, representada en este acto por{" "}
            <Text style={styles.bold}>{company.legalRepName}</Text>, varón,{" "}
            {company.legalRepNationality || "panameño"}, {company.legalRepMaritalStatus || "mayor de edad"},{" "}
            portador del pasaporte No. <Text style={styles.bold}>{company.legalRepPassport || "N/A"}</Text>,{" "}
            con domicilio en <Text style={styles.bold}>{company.address}</Text>, quien en adelante se denominará{" "}
            <Text style={styles.bold}>EL ARRENDADOR</Text>;
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text>
            Por otra parte: <Text style={styles.bold}>{client.fullName}</Text>,{" "}
            {client.nationality || "panameño(a)"}, {client.maritalStatus || "mayor de edad"},{" "}
            portador(a) de la cédula de identidad personal No. <Text style={styles.bold}>{client.identificationNumber}</Text>,{" "}
            con teléfono <Text style={styles.bold}>{client.phone}</Text>,{" "}
            con domicilio en <Text style={styles.bold}>{client.address}</Text>, quien en adelante se denominará{" "}
            <Text style={styles.bold}>EL ARRENDATARIO</Text>;
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text style={styles.bold}>
            Han convenido en celebrar el presente CONTRATO DE ARRENDAMIENTO DE VEHÍCULO, que se regirá por las siguientes cláusulas:
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL VEHÍCULO</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo/Nombre:</Text>
            <Text style={styles.infoValue}>{vehicle.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Marca:</Text>
            <Text style={styles.infoValue}>{vehicle.brand}</Text>
          </View>
          {vehicle.model && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Modelo:</Text>
              <Text style={styles.infoValue}>{vehicle.model}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Año:</Text>
            <Text style={styles.infoValue}>{vehicle.year}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Color:</Text>
            <Text style={styles.infoValue}>{vehicle.color}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Placa:</Text>
            <Text style={styles.infoValue}>{vehicle.placa}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>VIN/Chasis:</Text>
            <Text style={styles.infoValue}>{vehicle.vin}</Text>
          </View>
          {vehicle.engineNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. Motor:</Text>
              <Text style={styles.infoValue}>{vehicle.engineNumber}</Text>
            </View>
          )}
          {vehicle.passengerCapacity && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Capacidad:</Text>
              <Text style={styles.infoValue}>{vehicle.passengerCapacity} pasajeros</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 1 de 7</Text>
      </Page>

      {/* PÁGINA 2: Cláusulas 1-5 */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA PRIMERA: OBJETO DEL CONTRATO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR da en arrendamiento a EL ARRENDATARIO el vehículo descrito anteriormente, 
          marca {vehicle.brand}, año {vehicle.year}, color {vehicle.color}, con placa {vehicle.placa}, 
          por un período de {contract.totalQuotas} cuotas {paymentLabel}es, para ser utilizado 
          exclusivamente en el servicio selectivo de transporte de pasajeros.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA SEGUNDA: CONDICIONES DEL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO declara haber recibido el vehículo en perfectas condiciones mecánicas 
          y de carrocería, comprometiéndose a devolverlo en las mismas condiciones, salvo el 
          desgaste normal por el uso. Cualquier daño será responsabilidad de EL ARRENDATARIO.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TERCERA: LÍMITES GEOGRÁFICOS</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO se compromete a operar el vehículo únicamente dentro de los siguientes 
          límites geográficos de la República de Panamá:
        </Text>
        <View style={styles.indent}>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.listText}>Norte: Hasta la Provincia de Colón</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.listText}>Este: Hasta el Distrito de Chepo</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.listText}>Oeste: Hasta las Provincias de Chiriquí y Bocas del Toro</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>• </Text>
            <Text style={styles.listText}>Sur: Área Metropolitana de la Ciudad de Panamá</Text>
          </View>
        </View>

        <Text style={styles.clauseTitle}>CLÁUSULA CUARTA: NATURALEZA DE LA RELACIÓN</Text>
        <Text style={styles.clauseText}>
          Las partes declaran expresamente que el presente contrato es de naturaleza estrictamente 
          comercial y no genera relación laboral alguna entre EL ARRENDADOR y EL ARRENDATARIO. 
          EL ARRENDATARIO opera como contratista independiente.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA QUINTA: TÉRMINO DEL CONTRATO</Text>
        <Text style={styles.clauseText}>
          El presente contrato tendrá una duración de {contract.totalQuotas} cuotas {paymentLabel}es, 
          contadas a partir de la fecha de firma del presente documento. El contrato podrá terminarse 
          anticipadamente por mutuo acuerdo de las partes o por incumplimiento de cualquiera de las 
          obligaciones aquí establecidas.
        </Text>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 2 de 7</Text>
      </Page>

      {/* PÁGINA 3: Cláusulas 6-10 */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA SEXTA: TRASPASO DEL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          Queda expresamente prohibido a EL ARRENDATARIO ceder, subarrendar o traspasar el vehículo 
          objeto de este contrato a terceras personas sin la autorización previa y por escrito de 
          EL ARRENDADOR. El incumplimiento de esta cláusula dará derecho a EL ARRENDADOR a dar por 
          terminado el contrato de inmediato.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA SÉPTIMA: USO EXCLUSIVO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO se compromete a utilizar el vehículo exclusivamente para el servicio 
          selectivo de transporte de pasajeros a través de plataformas autorizadas. Queda 
          terminantemente prohibido el uso del vehículo para transporte de carga, sustancias 
          ilícitas, o cualquier actividad contraria a la ley.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA OCTAVA: MONTO DEL ARRENDAMIENTO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO se obliga a pagar a EL ARRENDADOR la suma de{" "}
          <Text style={styles.bold}>{formatCurrency(contract.quotaAmount)}</Text> ({paymentLabel}) 
          en concepto de canon de arrendamiento. Adicionalmente, EL ARRENDATARIO ha entregado un 
          depósito de garantía por la suma de{" "}
          <Text style={styles.bold}>{formatCurrency(contract.initialDeposit)}</Text>.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA NOVENA: FORMA Y HORARIO DE PAGO</Text>
        <Text style={styles.clauseText}>
          Los pagos {paymentLabel}es deberán realizarse los días martes de cada semana. 
          EL ARRENDATARIO tendrá hasta el jueves a las 12:00 del mediodía (12:00 m.d.) como 
          fecha límite para realizar el pago correspondiente. Los pagos podrán realizarse en 
          efectivo en las oficinas de EL ARRENDADOR o mediante transferencia bancaria a la 
          cuenta designada.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA: RECARGO POR INCUMPLIMIENTO</Text>
        <Text style={styles.clauseText}>
          En caso de que EL ARRENDATARIO no realice el pago dentro del plazo establecido, 
          se aplicará un recargo del <Text style={styles.bold}>DIEZ POR CIENTO (10%)</Text> diario 
          sobre el monto de la cuota pendiente. Este recargo se calculará por cada día de atraso 
          hasta que se regularice el pago.
        </Text>
        <View style={styles.indent}>
          <Text style={styles.clauseText}>
            Ejemplo: Si la cuota es de {formatCurrency(contract.quotaAmount)}, la multa diaria 
            será de {formatCurrency(contract.quotaAmount * 0.1)}.
          </Text>
        </View>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 3 de 7</Text>
      </Page>

      {/* PÁGINA 4: Cláusulas 11-17 */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA PRIMERA: SEGURO DEL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR mantendrá vigente un seguro de responsabilidad civil y daños a terceros 
          durante la vigencia del contrato. Sin embargo, EL ARRENDATARIO será responsable de 
          cualquier deducible en caso de siniestro, así como de los daños no cubiertos por 
          la póliza de seguro.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA SEGUNDA: MULTAS DE TRÁNSITO</Text>
        <Text style={styles.clauseText}>
          Todas las multas de tránsito incurridas durante el período de arrendamiento serán 
          responsabilidad exclusiva de EL ARRENDATARIO, quien deberá pagarlas en un plazo 
          máximo de quince (15) días calendario desde su notificación.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA TERCERA: LICENCIA DE CONDUCIR</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO declara poseer licencia de conducir vigente y válida en la República 
          de Panamá, la cual mantendrá vigente durante toda la duración del presente contrato. 
          EL ARRENDATARIO se obliga a presentar copia de su licencia actualizada cuando 
          EL ARRENDADOR lo requiera.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA CUARTA: MANTENIMIENTO DEL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR se compromete a realizar el mantenimiento preventivo del vehículo cada 
          <Text style={styles.bold}> 5,000 kilómetros</Text>, cuyo costo será cubierto en un 
          CIEN POR CIENTO (100%) por EL ARRENDADOR. EL ARRENDATARIO deberá presentar el vehículo 
          para mantenimiento cuando alcance el kilometraje correspondiente.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA QUINTA: REPARACIONES MAYORES</Text>
        <Text style={styles.clauseText}>
          Las reparaciones mayores por desgaste normal o defectos de fabricación serán 
          responsabilidad de EL ARRENDADOR. Sin embargo, las reparaciones derivadas de 
          negligencia, mal uso o accidentes serán responsabilidad de EL ARRENDATARIO.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA SEXTA: COMBUSTIBLE</Text>
        <Text style={styles.clauseText}>
          El combustible del vehículo será responsabilidad exclusiva de EL ARRENDATARIO. 
          El vehículo utiliza combustible tipo {vehicle.fuelType || "gasolina"}.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA SÉPTIMA: LAVADO Y LIMPIEZA</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO se compromete a mantener el vehículo limpio tanto interior como 
          exteriormente. El vehículo deberá presentarse limpio para cada mantenimiento programado.
        </Text>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 4 de 7</Text>
      </Page>

      {/* PÁGINA 5: Cláusulas 18-25 */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA OCTAVA: INSPECCIONES</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR podrá realizar inspecciones del vehículo en cualquier momento, previo 
          aviso de veinticuatro (24) horas a EL ARRENDATARIO. Estas inspecciones verificarán 
          el estado del vehículo y el cumplimiento de las condiciones del contrato.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA DÉCIMA NOVENA: MODIFICACIONES AL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          Queda prohibido a EL ARRENDATARIO realizar modificaciones al vehículo sin autorización 
          previa y por escrito de EL ARRENDADOR. Esto incluye, pero no se limita a: cambios en 
          el sistema de escape, suspensión, pintura, rotulación no autorizada, entre otros.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA: DOCUMENTOS DEL VEHÍCULO</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR entrega a EL ARRENDATARIO copia de los documentos del vehículo necesarios 
          para su operación legal. EL ARRENDATARIO deberá portar siempre estos documentos en el 
          vehículo y devolverlos al término del contrato.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA PRIMERA: DEPÓSITO DE GARANTÍA</Text>
        <Text style={styles.clauseText}>
          El depósito de garantía de <Text style={styles.bold}>{formatCurrency(contract.initialDeposit)}</Text>{" "}
          entregado por EL ARRENDATARIO <Text style={styles.bold}>NO será devuelto</Text> y se aplicará 
          a las primeras cuotas del arrendamiento o a cualquier daño pendiente al término del contrato.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA SEGUNDA: TERMINACIÓN ANTICIPADA</Text>
        <Text style={styles.clauseText}>
          Cualquiera de las partes podrá dar por terminado el contrato con un aviso previo de 
          treinta (30) días. En caso de terminación anticipada por parte de EL ARRENDATARIO, 
          este perderá el depósito de garantía.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA TERCERA: CAUSALES DE TERMINACIÓN INMEDIATA</Text>
        <Text style={styles.clauseText}>
          EL ARRENDADOR podrá dar por terminado el contrato de forma inmediata en los siguientes casos:
        </Text>
        <View style={styles.indent}>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>a) </Text>
            <Text style={styles.listText}>Mora en el pago de tres (3) cuotas consecutivas</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>b) </Text>
            <Text style={styles.listText}>Uso del vehículo para actividades ilícitas</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>c) </Text>
            <Text style={styles.listText}>Subarriendo no autorizado del vehículo</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>d) </Text>
            <Text style={styles.listText}>Daño intencional al vehículo</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>e) </Text>
            <Text style={styles.listText}>Suspensión o cancelación de la licencia de conducir</Text>
          </View>
        </View>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 5 de 7</Text>
      </Page>

      {/* PÁGINA 6: Cláusulas 26-35 */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA CUARTA: ACCIDENTES</Text>
        <Text style={styles.clauseText}>
          En caso de accidente, EL ARRENDATARIO deberá notificar de inmediato a EL ARRENDADOR 
          y a las autoridades competentes. EL ARRENDATARIO no deberá abandonar el lugar del 
          accidente hasta que lleguen las autoridades.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA QUINTA: ROBO O HURTO</Text>
        <Text style={styles.clauseText}>
          En caso de robo o hurto del vehículo, EL ARRENDATARIO deberá reportar inmediatamente 
          a las autoridades y a EL ARRENDADOR. Se deberá presentar la denuncia correspondiente 
          en un plazo máximo de veinticuatro (24) horas.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA SEXTA: OBLIGACIONES DE EL ARRENDATARIO</Text>
        <Text style={styles.clauseText}>EL ARRENDATARIO se obliga a:</Text>
        <View style={styles.indent}>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>1. </Text>
            <Text style={styles.listText}>Pagar puntualmente las cuotas de arrendamiento</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>2. </Text>
            <Text style={styles.listText}>Mantener el vehículo en buen estado</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>3. </Text>
            <Text style={styles.listText}>Conducir de forma responsable y respetar las leyes de tránsito</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>4. </Text>
            <Text style={styles.listText}>Presentar el vehículo para mantenimientos programados</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>5. </Text>
            <Text style={styles.listText}>Mantener vigente su licencia de conducir</Text>
          </View>
        </View>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA SÉPTIMA: OBLIGACIONES DE EL ARRENDADOR</Text>
        <Text style={styles.clauseText}>EL ARRENDADOR se obliga a:</Text>
        <View style={styles.indent}>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>1. </Text>
            <Text style={styles.listText}>Entregar el vehículo en condiciones óptimas</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>2. </Text>
            <Text style={styles.listText}>Mantener vigente el seguro del vehículo</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>3. </Text>
            <Text style={styles.listText}>Realizar los mantenimientos preventivos cada 5,000 km</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>4. </Text>
            <Text style={styles.listText}>Proporcionar los documentos necesarios para la operación</Text>
          </View>
        </View>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA OCTAVA: CONFIDENCIALIDAD</Text>
        <Text style={styles.clauseText}>
          Ambas partes se comprometen a mantener la confidencialidad de los términos de este 
          contrato y de cualquier información sensible compartida durante la relación comercial.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA VIGÉSIMA NOVENA: DATOS PERSONALES</Text>
        <Text style={styles.clauseText}>
          EL ARRENDATARIO autoriza a EL ARRENDADOR a almacenar y procesar sus datos personales 
          conforme a las leyes de protección de datos de la República de Panamá.
        </Text>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 6 de 7</Text>
      </Page>

      {/* PÁGINA 7: Cláusulas finales y firmas */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA: COMUNICACIONES</Text>
        <Text style={styles.clauseText}>
          Todas las comunicaciones entre las partes se realizarán a través de los datos de 
          contacto indicados en este contrato. Cualquier cambio deberá ser notificado por 
          escrito a la otra parte.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA PRIMERA: MODIFICACIONES</Text>
        <Text style={styles.clauseText}>
          Cualquier modificación a los términos de este contrato deberá realizarse por escrito 
          y ser firmada por ambas partes.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA SEGUNDA: JURISDICCIÓN</Text>
        <Text style={styles.clauseText}>
          Para todos los efectos legales, las partes se someten a la jurisdicción de los 
          tribunales de la República de Panamá, renunciando a cualquier otro fuero que 
          pudiera corresponderles.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA TERCERA: INTERPRETACIÓN</Text>
        <Text style={styles.clauseText}>
          En caso de duda sobre la interpretación de cualquier cláusula de este contrato, 
          prevalecerá la interpretación más favorable a la continuidad del contrato y la 
          buena fe entre las partes.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA CUARTA: GASTOS</Text>
        <Text style={styles.clauseText}>
          Los gastos de formalización del presente contrato, si los hubiere, serán asumidos 
          por ambas partes en partes iguales.
        </Text>

        <Text style={styles.clauseTitle}>CLÁUSULA TRIGÉSIMA QUINTA: ACEPTACIÓN</Text>
        <Text style={styles.clauseText}>
          En fe de lo cual, ambas partes declaran haber leído y comprendido todas las 
          cláusulas del presente contrato, aceptando sus términos y condiciones, y firman 
          en dos ejemplares de igual tenor y valor, en la Ciudad de Panamá, a los{" "}
          {formatDate(contract.contractDate)}.
        </Text>

        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>EL ARRENDADOR</Text>
            <Text style={styles.signatureName}>{company.legalRepName}</Text>
            <Text style={styles.signatureLabel}>{company.name}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>EL ARRENDATARIO</Text>
            <Text style={styles.signatureName}>{client.fullName}</Text>
            <Text style={styles.signatureLabel}>Cédula: {client.identificationNumber}</Text>
          </View>
        </View>

        <View style={{ marginTop: 40, padding: 10, backgroundColor: "#F8F8F8", borderRadius: 4 }}>
          <Text style={{ fontSize: 9, textAlign: "center", color: "#666" }}>
            Contrato generado electrónicamente por {company.name}
          </Text>
          <Text style={{ fontSize: 9, textAlign: "center", color: "#666" }}>
            Fecha de generación: {format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
          </Text>
        </View>

        <Text style={styles.footer}>{company.name} - Contrato #{contractNumber}</Text>
        <Text style={styles.pageNumber}>Página 7 de 7</Text>
      </Page>
    </Document>
  );
};

// Componente de botón para descargar PDF
interface ContractPDFDownloadProps extends ContractPDFProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ContractPDFDownload({
  company,
  client,
  vehicle,
  contract,
  className,
  variant = "default",
  size = "default",
}: ContractPDFDownloadProps) {
  const contractNumber = contract.contractNumber || `C4Y-${Date.now()}`;
  const fileName = `Contrato_${contractNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${client.fullName.replace(/\s+/g, "_")}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ContractDocument
          company={company}
          client={client}
          vehicle={vehicle}
          contract={contract}
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2", className)}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando contrato...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Descargar Contrato PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

// Export del componente de documento para uso directo
export { ContractDocument };
