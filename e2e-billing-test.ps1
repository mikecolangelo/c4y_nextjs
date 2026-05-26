$token = 'frontend_token_1775409392'
$finId = 'oluckesz5t20umk7xahp6cj5'
$finNumId = 44
$baseStrapi = 'https://api.car4youpanama.com'
$baseLocal = 'http://localhost:3000'
$futureDate = '2026-06-01'

function Strapi-List($filters) {
    $q = ($filters -join '&')
    return Invoke-RestMethod -Uri "$baseStrapi/api/billing-records?$q" -Headers @{Authorization="Bearer $token"}
}
function Strapi-Delete($docId) {
    try {
        Invoke-RestMethod -Uri "$baseStrapi/api/billing-records/$docId" -Headers @{Authorization="Bearer $token"} -Method DELETE | Out-Null
        return $true
    } catch { return $false }
}
function Strapi-Create($payload) {
    $body = @{ data = $payload } | ConvertTo-Json -Depth 3
    return Invoke-RestMethod -Uri "$baseStrapi/api/billing-records" -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Method POST -Body $body
}
function Local-PostBilling($payload) {
    $body = @{ data = $payload } | ConvertTo-Json -Depth 3
    return Invoke-RestMethod -Uri "$baseLocal/api/billing" -Headers @{"Content-Type"="application/json"} -Method POST -Body $body
}
function Reset-Financing() {
    $fin = Invoke-RestMethod -Uri "$baseStrapi/api/financings/$finId" -Headers @{Authorization="Bearer $token"}
    $total = $fin.data.totalAmount
    $reset = @{ data = @{ paidQuotas = 0; totalPaid = 0; currentBalance = $total; partialPaymentCredit = 0; totalLateFees = 0; status = "activo" } } | ConvertTo-Json -Depth 3
    Invoke-RestMethod -Uri "$baseStrapi/api/financings/$finId" -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Method PUT -Body $reset | Out-Null
    return $total
}
function Get-Record($docId) {
    $r = Strapi-List "filters[documentId][`$eq]=$docId", "pagination[pageSize]=1"
    return $r.data | Select-Object -First 1
}

Write-Host "========================================"
Write-Host "E2E TESTS BILLING FIXES (v2)"
Write-Host "========================================"

# ---- LIMPIEZA INICIAL ----
Write-Host "`n[SETUP] Limpiando records existentes..."
$existing = Strapi-List "filters[financing][documentId][`$eq]=$finId", "pagination[pageSize]=100"
foreach ($r in $existing.data) {
    Strapi-Delete $r.documentId | Out-Null
}
$totalAmount = Reset-Financing
Write-Host "[SETUP] Limpio. Balance restaurado a $totalAmount"

# ---- ESCENARIO 1: PAGO EXACTO ----
Write-Host "`n========================================"
Write-Host "ESCENARIO 1: PAGO EXACTO"
Write-Host "========================================"

# 1a. Crear cuota pendiente #1 directo en Strapi
$q1 = Strapi-Create @{
    financing = $finNumId
    receiptNumber = "QUOTA-TEST-001"
    amount = 386.36
    currency = "PAB"
    status = "pendiente"
    dueDate = $futureDate
    quotaNumber = 1
    lateFeeAmount = 0
}
$q1Id = $q1.data.documentId
Write-Host "[1a] Cuota #1 creada: $q1Id"

# 1b. Pago exacto via API local
$p1 = Local-PostBilling @{
    financing = $finId
    amount = 386.36
    quotaNumber = 1
    dueDate = $futureDate
    status = "abonado"
    currency = "PAB"
    receiptNumber = "PAY-EXACT-001"
}
$p1Id = $p1.data.documentId
Write-Host "[1b] Pago creado: $p1Id (status=$($p1.data.status))"

# 1c. Verificar cuota #1 via list query
Start-Sleep -Seconds 2
$check1 = Get-Record $q1Id
Write-Host "[1c] Cuota #1 despues de pago: status=$($check1.status)"

if ($check1.status -eq "pagado") {
    Write-Host "[PASS] Escenario 1: Pago exacto funciona correctamente"
} else {
    Write-Host "[FAIL] Escenario 1: Esperado status=pagado, got status=$($check1.status)"
}

# ---- ESCENARIO 2: ADELANTO SIN CUOTA ----
Write-Host "`n========================================"
Write-Host "ESCENARIO 2: ADELANTO SIN CUOTA"
Write-Host "========================================"

$p2 = Local-PostBilling @{
    financing = $finId
    amount = 100
    quotaNumber = 0
    dueDate = $futureDate
    status = "abonado"
    currency = "PAB"
    receiptNumber = "PAY-ADV-002"
}
$p2Id = $p2.data.documentId
Write-Host "[2a] Pago creado: $p2Id (status=$($p2.data.status), q#=$($p2.data.quotaNumber))"

if ($p2.data.status -eq "adelanto" -and $p2.data.quotaNumber -eq 0) {
    Write-Host "[PASS] Escenario 2: Adelanto sin cuota funciona correctamente"
} else {
    Write-Host "[FAIL] Escenario 2: Esperado status=adelanto y q#=0, got status=$($p2.data.status) y q#=$($p2.data.quotaNumber)"
}

# ---- ESCENARIO 3: AUTO-COVER CON MULTIPLES ADELANTOS ----
Write-Host "`n========================================"
Write-Host "ESCENARIO 3: AUTO-COVER MULTI-ADELANTO"
Write-Host "========================================"

# 3a. Crear segundo adelanto ($200)
$p3 = Local-PostBilling @{
    financing = $finId
    amount = 200
    quotaNumber = 0
    dueDate = $futureDate
    status = "abonado"
    currency = "PAB"
    receiptNumber = "PAY-ADV-003"
}
$p3Id = $p3.data.documentId
Write-Host "[3a] Segundo adelanto: $p3Id (status=$($p3.data.status))"

# 3b. Crear cuota #2 pendiente
$q2 = Strapi-Create @{
    financing = $finNumId
    receiptNumber = "QUOTA-TEST-002"
    amount = 386.36
    currency = "PAB"
    status = "pendiente"
    dueDate = $futureDate
    quotaNumber = 2
    lateFeeAmount = 0
}
$q2Id = $q2.data.documentId
Write-Host "[3b] Cuota #2 creada: $q2Id"

# 3c. Trigger auto-cover via POST pequeno
$pTrigger = Local-PostBilling @{
    financing = $finId
    amount = 1
    quotaNumber = 0
    dueDate = $futureDate
    status = "abonado"
    currency = "PAB"
    receiptNumber = "PAY-TRIGGER-004"
}
Write-Host "[3c] Trigger payment creado: $($pTrigger.data.documentId) (status=$($pTrigger.data.status))"

# 3d. Verificar cuota #2
Start-Sleep -Seconds 2
$check2 = Get-Record $q2Id
Write-Host "[3d] Cuota #2 despues de auto-cover: status=$($check2.status)"

# 3e. Verificar adelantos
$adv2 = Get-Record $p2Id
$adv3 = Get-Record $p3Id
Write-Host "[3e] Adelanto $p2Id : amount=$($adv2.amount), status=$($adv2.status)"
Write-Host "[3e] Adelanto $p3Id : amount=$($adv3.amount), status=$($adv3.status)"

# 3f. Verificar metrics
$finCheck = Invoke-RestMethod -Uri "$baseStrapi/api/financings/$finId" -Headers @{Authorization="Bearer $token"}
Write-Host "[3f] Financing: paidQuotas=$($finCheck.data.paidQuotas), totalPaid=$($finCheck.data.totalPaid), balance=$($finCheck.data.currentBalance)"

# Evaluacion
if ($check2.status -eq "pagado" -or $check2.status -eq "abonado") {
    Write-Host "[PASS] Escenario 3: Auto-cover con multiples adelantos funciona (status=$($check2.status))"
} else {
    Write-Host "[FAIL] Escenario 3: Esperado pagado/abonado, got status=$($check2.status)"
}

Write-Host "`n========================================"
Write-Host "RESUMEN E2E"
Write-Host "========================================"
