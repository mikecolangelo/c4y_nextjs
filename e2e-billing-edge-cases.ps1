$ErrorActionPreference = 'Stop'

$token = 'frontend_token_1775409392'
$baseStrapi = 'https://api.car4youpanama.com'
$baseLocal = 'http://localhost:3000'

# Financing de pruebas (ajustar si necesitas otro)
$financingDocumentId = 'l39m443olgheszh1wqk8zkwq'
$financingNumericId = 37

$results = @()

function Add-Result {
  param(
    [string]$Case,
    [bool]$Pass,
    [string]$Expected,
    [string]$Actual
  )
  $script:results += [pscustomobject]@{
    Case = $Case
    Pass = if ($Pass) { 'PASS' } else { 'FAIL' }
    Expected = $Expected
    Actual = $Actual
  }
}

function Get-Records {
  $url = "$baseStrapi/api/billing-records?filters[financing][documentId][`$eq]=$financingDocumentId&pagination[pageSize]=200&populate[parentRecord][fields][0]=documentId&populate[childRecords][fields][0]=documentId&populate[childRecords][fields][1]=amount&populate[childRecords][fields][2]=status"
  return (Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $token" }).data
}

function Clear-Records {
  $records = Get-Records
  foreach ($r in $records) {
    try {
      Invoke-RestMethod -Uri "$baseStrapi/api/billing-records/$($r.documentId)" -Headers @{ Authorization = "Bearer $token" } -Method DELETE | Out-Null
    } catch {
      # ignore
    }
  }
}

function New-StrapiRecord {
  param([hashtable]$Data)
  $body = @{ data = $Data } | ConvertTo-Json -Depth 6
  return Invoke-RestMethod -Uri "$baseStrapi/api/billing-records" -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } -Method POST -Body $body
}

function Post-Payment {
  param([hashtable]$Data)
  $body = @{ data = $Data } | ConvertTo-Json -Depth 6
  return Invoke-RestMethod -Uri "$baseLocal/api/billing" -Method POST -ContentType 'application/json' -Body $body
}

function Post-AutoCover {
  $body = @{ financingDocumentId = $financingDocumentId } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$baseLocal/api/billing/auto-cover" -Method POST -ContentType 'application/json' -Body $body
}

function Find-ByDoc {
  param([array]$Records, [string]$DocId)
  return $Records | Where-Object { $_.documentId -eq $DocId } | Select-Object -First 1
}

$ts = Get-Date -Format 'yyyyMMddHHmmss'

Write-Host "Running edge-case suite on financing $financingDocumentId ..."

# CASE 1: Abonado mas antiguo primero
Clear-Records
$q5 = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC1-Q5-$ts"; amount = 225; currency = 'PAB'; status = 'abonado'; dueDate = '2026-05-01'; quotaNumber = 5; lateFeeAmount = 0 }
$null = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC1-AB5-$ts"; amount = 175; currency = 'PAB'; status = 'abonado'; dueDate = '2026-05-01'; quotaNumber = 5; parentRecord = [int]$q5.data.id; lateFeeAmount = 0 }
$q6 = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC1-Q6-$ts"; amount = 225; currency = 'PAB'; status = 'pendiente'; dueDate = '2026-05-08'; quotaNumber = 6; lateFeeAmount = 0 }
$pay1 = Post-Payment @{ financing = $financingDocumentId; amount = 200; quotaNumber = 0; dueDate = '2026-05-10'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC1-PAY-$ts" }
$pass1 = ($pay1.data.parentRecordId -eq $q5.data.documentId)
Add-Result -Case 'EC1 Abonado mas antiguo primero' -Pass $pass1 -Expected "parentRecordId=$($q5.data.documentId)" -Actual "parentRecordId=$($pay1.data.parentRecordId)"

# CASE 2: Sin cuotas -> adelanto
Clear-Records
$pay2 = Post-Payment @{ financing = $financingDocumentId; amount = 100; quotaNumber = 0; dueDate = '2026-05-10'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC2-PAY-$ts" }
$pass2 = ($pay2.data.status -eq 'adelanto' -and [int]$pay2.data.quotaNumber -eq 0)
Add-Result -Case 'EC2 Sin cuotas crea adelanto' -Pass $pass2 -Expected 'status=adelanto,q#=0' -Actual "status=$($pay2.data.status),q#=$($pay2.data.quotaNumber)"

# CASE 3: Pago exacto a cuota pendiente
Clear-Records
$q1 = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC3-Q1-$ts"; amount = 225; currency = 'PAB'; status = 'pendiente'; dueDate = '2026-05-11'; quotaNumber = 1; lateFeeAmount = 0 }
$pay3 = Post-Payment @{ financing = $financingDocumentId; amount = 225; quotaNumber = 0; dueDate = '2026-05-11'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC3-PAY-$ts" }
Start-Sleep -Seconds 2
$records3 = Get-Records
$q1After = Find-ByDoc -Records $records3 -DocId $q1.data.documentId
$pass3 = ($pay3.data.parentRecordId -eq $q1.data.documentId -and $q1After.status -eq 'pagado')
Add-Result -Case 'EC3 Pago exacto liquida cuota' -Pass $pass3 -Expected "parent=$($q1.data.documentId),status cuota=pagado" -Actual "parent=$($pay3.data.parentRecordId),status cuota=$($q1After.status)"

# CASE 4: Cuota abonada con faltante + pago mayor (genera excedente)
Clear-Records
$q4 = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC4-Q4-$ts"; amount = 225; currency = 'PAB'; status = 'abonado'; dueDate = '2026-05-01'; quotaNumber = 4; lateFeeAmount = 0 }
$null = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC4-AB4-$ts"; amount = 175; currency = 'PAB'; status = 'abonado'; dueDate = '2026-05-01'; quotaNumber = 4; parentRecord = [int]$q4.data.id; lateFeeAmount = 0 }
$q5b = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC4-Q5-$ts"; amount = 225; currency = 'PAB'; status = 'pendiente'; dueDate = '2026-05-08'; quotaNumber = 5; lateFeeAmount = 0 }
$pay4 = Post-Payment @{ financing = $financingDocumentId; amount = 200; quotaNumber = 0; dueDate = '2026-05-10'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC4-PAY-$ts" }
Start-Sleep -Seconds 2
$records4 = Get-Records
$q4After = Find-ByDoc -Records $records4 -DocId $q4.data.documentId
$q5bAfter = Find-ByDoc -Records $records4 -DocId $q5b.data.documentId
$pass4 = ($pay4.data.parentRecordId -eq $q4.data.documentId -and $q4After.status -eq 'pagado' -and $q5bAfter.status -in @('abonado','pagado'))
Add-Result -Case 'EC4 Excedente sobre abonado se redistribuye' -Pass $pass4 -Expected 'pago->q4, q4 pagado, q5 recibe excedente' -Actual "parent=$($pay4.data.parentRecordId),q4=$($q4After.status),q5=$($q5bAfter.status)"

# CASE 5: Multi-adelantos FIFO sobre cuota pendiente
Clear-Records
$a1 = Post-Payment @{ financing = $financingDocumentId; amount = 50; quotaNumber = 0; dueDate = '2026-05-10'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC5-A1-$ts" }
$a2 = Post-Payment @{ financing = $financingDocumentId; amount = 100; quotaNumber = 0; dueDate = '2026-05-10'; status = 'abonado'; currency = 'PAB'; receiptNumber = "EC5-A2-$ts" }
$qf = New-StrapiRecord @{ financing = $financingNumericId; receiptNumber = "EC5-Q1-$ts"; amount = 225; currency = 'PAB'; status = 'pendiente'; dueDate = '2026-05-11'; quotaNumber = 1; lateFeeAmount = 0 }
$null = Post-AutoCover
Start-Sleep -Seconds 2
$records5 = Get-Records
$qfAfter = Find-ByDoc -Records $records5 -DocId $qf.data.documentId
$a1After = Find-ByDoc -Records $records5 -DocId $a1.data.documentId
$a2After = Find-ByDoc -Records $records5 -DocId $a2.data.documentId
$pass5 = ($qfAfter.status -eq 'abonado' -and $a1After.status -eq 'pagado' -and $a2After.status -eq 'pagado')
Add-Result -Case 'EC5 FIFO multi-adelantos parcial' -Pass $pass5 -Expected 'cuota abonado, adelantos consumidos' -Actual "q=$($qfAfter.status),a1=$($a1After.status),a2=$($a2After.status)"

Write-Host ""
Write-Host "========== EDGE CASE RESULTS =========="
$results | Format-Table -AutoSize

$fails = ($results | Where-Object { $_.Pass -eq 'FAIL' }).Count
if ($fails -eq 0) {
  Write-Host "ALL PASS ($($results.Count)/$($results.Count))"
  exit 0
}

Write-Host "FAILED: $fails case(s)"
exit 1
